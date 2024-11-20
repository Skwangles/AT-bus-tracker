import axios from 'axios';
import { ApiConfig } from './types';
import { Node, Edge, Location } from '../types';

export class ApiClient {
  private client;

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: config.apiKey ? {
        'Authorization': `Bearer ${config.apiKey}`
      } : undefined
    });
  }

  async getLocations(): Promise<Location[]> {
    const { data } = await this.client.get<Location[]>('/locations');
    return data;
  }

  async getNodes(): Promise<Node[]> {
    const { data } = await this.client.get<Node[]>('/nodes');
    return data;
  }

  async getEdges(): Promise<Edge[]> {
    const { data } = await this.client.get<Edge[]>('/edges');
    return data;
  }
}