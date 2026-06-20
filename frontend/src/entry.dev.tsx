import { renderToString, type RenderToStringOptions } from "@builder.io/qwik/server";
import { manifest } from "@qwik-client-manifest";
import Root from "./root";

export default function (opts: RenderToStringOptions) {
  return renderToString(<Root />, opts, manifest);
}
