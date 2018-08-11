import { IRenderedForm } from "../FormEdit/FormEdit.d";
import { ResponsesState, IFormResponseTableDisplayData } from "../../store/responses/types";
import { IFormListItem } from "../FormList/FormList.d";
import { FormState } from "../../store/form/types";

export interface IResponseTableProps extends ResponsesState {
    match: {
        params: {
            formId: string,
            tableViewName: string
        },
        url: string
    },
    onError: (any) => void,
    editMode?: boolean,
    checkinMode?: boolean,
    selectedForm: IFormListItem,
    form: FormState,
    fetchRenderedForm: (x: string) => Promise<any>,
    fetchResponses: (x: string) => Promise<any>,
    setFormResponseTableDisplayData: (e: IFormResponseTableDisplayData) => void
}

export interface IResponseTableState {
}