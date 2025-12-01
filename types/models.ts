export type User = {id: string; name: string; rank: number};
export type Task = {id: string; title: string; assignedTo?: string; rankRequired?: number};
export type List = {id: string; name: string; tasks: Task[]};
export type Module = {name: string; enabled: boolean; minRank: number};
