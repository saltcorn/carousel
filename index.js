const {
  input,
  div,
  text,
  script,
  domReady,
  style,
  ol,
  li,
  a,
  span,
} = require("@saltcorn/markup/tags");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();

          const slide_views = await View.find_table_views_where(
            context.table_id,
            ({ viewtemplate, viewrow }) =>
              (viewtemplate.runMany || viewtemplate.renderRows) &&
              viewrow.name !== context.viewname
          );
          const slide_view_opts = slide_views.map((v) => v.name);
          const caption_views = await View.find_table_views_where(
            context.table_id,
            ({ viewtemplate, viewrow }) =>
              viewtemplate.renderRows && viewrow.name !== context.viewname
          );
          const caption_view_opts = caption_views.map((v) => v.name);

          return new Form({
            fields: [
              {
                name: "slide_view",
                label: "Slide view",
                type: "String",
                required: true,
                attributes: {
                  options: slide_view_opts.join(),
                },
              },
              {
                name: "caption_view",
                label: "Caption overlay view",
                sublabel: "Blank for no caption",
                type: "String",
                required: false,
                attributes: {
                  options: caption_view_opts.join(),
                },
              },
              {
                name: "controls",
                label: "Show controls",
                type: "Bool",
                required: true,
              },
              {
                name: "indicators",
                label: "Show indicators",
                type: "Bool",
                required: true,
              },
              {
                name: "dark_ctrl",
                label: "Dark controls and indicators",
                type: "Bool",
                required: true,
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = async (table_id) => {
  const table_fields = await Field.find({ table_id });
  return [
    {
      name: "id",
      type: "Integer",
      required: false,
    },
    ...table_fields.map((f) => {
      const sf = new Field(f);
      sf.required = false;
      return sf;
    }),
  ];
};

const run = async (
  table_id,
  viewname,
  { slide_view, caption_view, indicators, controls, dark_ctrl },
  state,
  extraArgs
) => {
  const sview = await View.findOne({ name: slide_view });
  if (!sview)
    return div(
      { class: "alert alert-danger" },
      "Carousel view incorrectly configured. Cannot find view: ",
      slide_view
    );

  const sresps = await sview.runMany(state, extraArgs);

  var capresps;
  if (caption_view) {
    const capview = await View.findOne({ name: caption_view });
    const table = await Table.findOne({ id: table_id });
    capresps = await capview.viewtemplateObj.renderRows(
      table,
      capview.name,
      capview.configuration,
      extraArgs,
      sresps.map((sr) => sr.row)
    );
  }

  if (sresps.length === 0) return div("No slides");

  return div(
    {
      id: "carousel",
      class: "carousel slide",
      "data-bs-ride": "carousel",
    },
    indicators &&
    ol(
      { class: "carousel-indicators" },
      sresps.map((htmlrow, ix) =>
        li({
          "data-bs-target": "#carousel",
          "data-bs-slide-to": `${ix}`,
          class: [ix === 0 && "active"],
        })
      )
    ),
    div(
      { class: "carousel-inner" },
      sresps.map(({ html, row }, ix) =>
        div(
          { class: ["carousel-item", ix == 0 && "active"] },
          div({ class: "d-block w-100" }, html),
          caption_view &&
          div({ class: "carousel-caption d-none d-md-block" }, capresps[ix])
        )
      )
    ),
    controls &&
    a(
      {
        class: "carousel-control-prev",
        //href: "#carouselExampleControls",
        role: "button",
        "data-bs-target": "#carousel",
        "data-bs-slide": "prev",
      },
      span({ class: "carousel-control-prev-icon", "aria-hidden": "true" }),
      span({ class: "sr-only" }, "Previous")
    ),
    controls &&
    a(
      {
        class: "carousel-control-next",
        //href: "#carouselExampleControls",
        "data-bs-target": "#carousel",
        role: "button",
        "data-bs-slide": "next",
      },
      span({ class: "carousel-control-next-icon", "aria-hidden": "true" }),
      span({ class: "sr-only" }, "Next")
    ),
    dark_ctrl &&
    style(
      `.carousel-indicators li.active{ background-color: #222;} 
.carousel-indicators li {background-color: #999;}
.carousel-control-next,.carousel-control-prev {filter: invert(90%);}`
    )
  );
};

module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [
    {
      name: "Carousel",
      description: "Slideshow of the underlying view",
      display_state_form: false,
      get_state_fields,
      configuration_workflow,
      run,
    },
  ],
};
