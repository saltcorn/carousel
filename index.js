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

          const num_fields = fields.filter(
            (f) => f?.type?.name === "Integer" || f?.type?.name === "Float"
          );

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
                name: "default_interval",
                label: "Interval (s)",
                type: "Integer",
                sublabel:
                  "Default interval if no interval field is specified or is missing",
                default: 10,
                required: true,
              },
              {
                name: "interval_field",
                label: "Interval field",
                sublabel: "Integer or Float field with interval in seconds",
                type: "String",
                required: false,
                attributes: {
                  options: num_fields.map((f) => f.name),
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
                name: "hover_pause",
                label: "Hover pause",
                sublabel: "Pause transitions if mouse hovers over slide",
                type: "Bool",
                required: true,
              },
              {
                name: "dark_ctrl",
                label: "Dark controls and indicators",
                type: "Bool",
                required: true,
              },
              {
                name: "reload",
                label: "Reload cycled",
                sublabel: "Reload the page when the slide cycle has completed",
                type: "Bool",
                required: true,
              },
              {
                name: "on_demand",
                label: "Load on demand",
                sublabel: "Load each slide view as shown",
                type: "Bool",
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
  {
    slide_view,
    caption_view,
    indicators,
    controls,
    dark_ctrl,
    reload,
    hover_pause,
    default_interval,
    interval_field,
    on_demand,
  },
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
  const table = await Table.findOne({ id: table_id });

  var capresps;
  if (caption_view) {
    const capview = await View.findOne({ name: caption_view });
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
      "data-bs-pause": hover_pause ? "hover" : "false",
      "data-bs-interval": default_interval
        ? default_interval * 1000
        : undefined,
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
          {
            class: ["carousel-item", ix == 0 && "active"],
            "data-bs-interval":
              interval_field && row[interval_field]
                ? +row[interval_field] * 1000
                : false,
            "data-view-source-url": on_demand
              ? `/view/${encodeURI(slide_view)}?${table.pk_name}=${
                  row[table.pk_name]
                }`
              : undefined,
          },
          div({ class: "d-block w-100" }, (!on_demand || ix == 0) && html),
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
      ),
    reload &&
      script(
        domReady(`
  document.getElementById('carousel').addEventListener('slid.bs.carousel', event => {
  if(event && event.to===0) {
    location.reload()
  }
})`)
      ),
    on_demand &&
      script(
        domReady(`
  document.getElementById('carousel').addEventListener('slide.bs.carousel', event => {
  const $eparent=$(event.relatedTarget)
  const $etarget=$eparent.find("div.d-block")
  const url = $eparent.attr("data-view-source-url")
  $.ajax(url, {
        headers: {
          pjaxpageload: "true",
          localizedstate: "true", //no admin bar
        },
        success: function (res, textStatus, request) {
          $etarget.html(res);   
          initialize_page();
        },
        error: function (res) {
          if (!checkNetworkError(res))
            notifyAlert({ type: "danger", text: res.responseText });
          if ($e.html() === "Loading...") $e.html("");
        },
      });
})`)
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
