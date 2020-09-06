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

          return new Form({
            fields: [
              {
                name: "slide_view",
                label: "Slide view",
                sublabel: "Blank for no popup",
                type: "String",
                required: true,
                attributes: {
                  options: slide_view_opts.join(),
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
  { slide_view, indicators, controls },
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

  if (sresps.length === 0) return div("No slides");

  return div(
    {
      id: "carouselExampleControls",
      class: "carousel slide",
      "data-ride": "carousel",
    },
    indicators &&
      ol(
        { class: "carousel-indicators" },
        sresps.map((htmlrow, ix) =>
          li({
            "data-target": "#carouselExampleIndicators",
            "data-slide-to": `${ix}`,
            class: [ix === 0 && "active"],
          })
        )
      ),
    div(
      { class: "carousel-inner" },
      sresps.map(({ html, row }, ix) =>
        div(
          { class: ["carousel-item", ix == 0 && "active"] },
          div({ class: "d-block w-100" }, html)
        )
      )
    ),
    controls &&
      a(
        {
          class: "carousel-control-prev",
          href: "#carouselExampleControls",
          role: "button",
          "data-slide": "prev",
        },
        span({ class: "carousel-control-prev-icon", "aria-hidden": "true" }),
        span({ class: "sr-only" }, "Previous")
      ),
    controls &&
      a(
        {
          class: "carousel-control-next",
          href: "#carouselExampleControls",
          role: "button",
          "data-slide": "next",
        },
        span({ class: "carousel-control-next-icon", "aria-hidden": "true" }),
        span({ class: "sr-only" }, "Next")
      )
  );
};

module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [
    {
      name: "Carousel",
      display_state_form: false,
      get_state_fields,
      configuration_workflow,
      run,
    },
  ],
};
