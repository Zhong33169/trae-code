import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { BookingDetail } from "~/components/BookingDetail";

export const useLoadingId = routeLoader$(({ params }) => {
  return Number(params.id) || 0;
});

export default component$(() => {
  const id = useLoadingId().value;
  return <BookingDetail module="loading" id={id} />;
});

export const head: DocumentHead = {
  title: "装柜详情 - 订舱管理系统",
};
