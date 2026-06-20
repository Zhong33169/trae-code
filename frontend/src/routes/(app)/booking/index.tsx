import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { BookingList } from "~/components/BookingList";

export default component$(() => {
  return <BookingList module="booking" moduleTitle="订舱申请" />;
});

export const head: DocumentHead = {
  title: "订舱申请 - 订舱管理系统",
};
