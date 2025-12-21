export interface RoomData {
  id: string;
  maxPlayers: number;
  currentPlayers: number;
  theme: string;
  gridSize: number;
  players: string[];
  host: string;
}

export interface RoomResponse {
  success?: boolean;
  error?: string;
  room?: RoomData;
}