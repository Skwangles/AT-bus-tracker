import { DatabaseAdapter } from './types';
import { Node, Edge, Location } from '../types';
import { ApiClient } from '../api/client';
import { ApiConfig } from '../api/types';

export class ApiAdapter implements DatabaseAdapter {
  private client: ApiClient;

  constructor(config: ApiConfig) {
    this.client = new ApiClient(config);
  }

  async initialize(): Promise<void> {
    // No initialization needed for API
  }

  async getLocations(): Promise<Location[]> {
    return this.client.getLocations();
  }

  async getNodes(): Promise<Node[]> {
    return this.client.getNodes();
  }

  async getEdges(): Promise<Edge[]> {
    return this.client.getEdges();
  }

  async close(): Promise<void> {
    // No cleanup needed for API
  }
}