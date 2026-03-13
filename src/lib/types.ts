export type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export type ParsedEntry = {
  type: "meal" | "weight" | "exercise";
  data: Record<string, unknown>;
};
