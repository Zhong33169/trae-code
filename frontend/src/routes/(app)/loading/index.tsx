import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { BookingList } from "~/components/BookingList";

export default component$(() => {
  return <BookingList module="loading" moduleTitle="装柜确认" />;
});

export const head: DocumentHead = {
  title: "装柜确认 - 订舱管理系统",
};
