import foodManagementReferenceHtml from 'virtual:food-management-reference'
import { softenInlineDomEventBindings, splitReferenceHtmlScripts } from './adminPreviewFrame'

const { htmlWithoutScripts: referenceHtmlWithoutScripts, inlineScript: referenceInlineScript } =
  splitReferenceHtmlScripts(foodManagementReferenceHtml)

export { referenceHtmlWithoutScripts }

export const safeReferenceScript = softenInlineDomEventBindings(referenceInlineScript)

export function isFoodManagementPreviewSourceAvailable(): boolean {
  return Boolean(referenceHtmlWithoutScripts.trim())
}
