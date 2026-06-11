import { PageProps } from "$fresh/server.ts";
import SelectionDetail from "../../islands/SelectionDetail.tsx";

export default function SelectionPage(props: PageProps) {
  return <SelectionDetail selectionId={props.params.id} />;
}
