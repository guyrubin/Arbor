/** A conversation belongs to one explicit parent question, including no question. */
export function threadForTopic<T>(conversation: { id: string | null; topicId?: string; messages: T[] }, selectedTopicId?: string): { id: string | null; topicId?: string; messages: T[] } {
  return conversation.id && conversation.topicId === selectedTopicId
    ? conversation
    : { id: null, topicId: selectedTopicId, messages: [] };
}
