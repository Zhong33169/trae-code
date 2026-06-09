import { PageProps } from "$fresh/server.ts";
import TransferDetail from "../../islands/TransferDetail.tsx";

export default function TransferPage(props: PageProps) {
  const id = props.params.id;
  return <TransferDetail id={id} />;
}
