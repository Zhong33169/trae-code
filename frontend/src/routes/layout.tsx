import { component$, Slot, useVisibleTask$ } from "@builder.io/qwik";
import { useAuthProvider } from "~/store/auth";
import { useMetaProvider } from "~/store/meta";
import { metaApi } from "~/api";

export default component$(() => {
  const auth = useAuthProvider();
  const meta = useMetaProvider();

  useVisibleTask$(async () => {
    if (!meta.loaded) {
      try {
        const data: any = await metaApi.enums();
        if (data && typeof data === 'object') {
          Object.assign(meta.enums, data);
        }
        meta.loaded = true;
      } catch (e) {
        meta.loaded = true;
      }
    }
  });

  return <Slot />;
});
