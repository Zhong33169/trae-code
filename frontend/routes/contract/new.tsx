import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { ROLE_NAMES, USERS } from "../../lib/constants.ts";
import ContractFormEditor from "../../islands/ContractFormEditor.tsx";

interface Data {
  user: { id: number; name: string; role: string };
}

export const handler: Handlers<Data> = {
  GET(req, ctx) {
    const url = new URL(req.url);
    const userId = parseInt(url.searchParams.get("userId") || "1");
    const user = USERS.find((u) => u.id === userId) || USERS[0];

    if (user.role !== "REGISTER") {
      return new Response("", {
        status: 302,
        headers: { Location: `/?userId=${userId}` },
      });
    }

    return ctx.render({ user });
  },
};

export default function NewContract(props: PageProps<Data>) {
  const { user } = props.data;

  return (
    <div class="min-h-screen bg-gray-50">
      <Head>
        <title>新建签约服务单</title>
      </Head>

      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <a
              href={`/?userId=${user.id}`}
              class="text-gray-500 hover:text-gray-700"
            >
              ← 返回列表
            </a>
            <div class="h-5 w-px bg-gray-200" />
            <h1 class="text-lg font-semibold text-gray-900">
              新建签约服务单
            </h1>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right text-sm">
              <span class="text-gray-500">当前角色：</span>
              <span class="font-medium text-gray-900">
                {user.name} · {ROLE_NAMES[user.role as keyof typeof ROLE_NAMES]}
              </span>
            </div>
            <div class="flex gap-1">
              {USERS.map((u) => (
                <a
                  key={u.id}
                  href={`/contract/new?userId=${u.id}`}
                  class={`px-3 py-1 text-sm rounded-md transition-colors ${
                    u.id === user.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {u.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 py-6">
        <ContractFormEditor
          userId={user.id}
          userRole={user.role}
        />
      </main>
    </div>
  );
}
