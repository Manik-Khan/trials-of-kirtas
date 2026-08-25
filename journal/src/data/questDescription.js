import '../../../quest-feed-capture.js'

const capture = globalThis.QuestFeedCapture

export const descriptionDoc = value => capture.descriptionDoc(value)
export const encodeDescription = value => capture.encodeDescription(value)
export const descriptionText = value => capture.descriptionText(value)
export const descriptionHTML = value => capture.descriptionHTML(value)
