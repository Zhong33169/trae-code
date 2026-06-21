import { Handlers, PageProps } from "$fresh/server.ts";

interface Data {
  message: string;
  time: string;
}

export const handler: Handlers<Data> = {
  GET(_req, ctx) {
    return ctx.render({
      message: "Fresh is working!",
      time: new Date().toISOString(),
    });
  },
};

export default function TestPage(props: PageProps<Data>) {
  return (
    <div class="p-8">
      <h1 class="text-2xl font-bold text-blue-600">{props.data.message}</h1>
      <p class="mt-4 text-gray-600">Server time: {props.data.time}</p>
    </div>
  );
}
