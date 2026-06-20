import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { BookingList } from "~/components/BookingList";

export default component$(() => {
  return <BookingList module="bl" moduleTitle="提单回收" />;
});

export const head: DocumentHead = {
  title: "提单回收 - 订舱管理系统",
};
