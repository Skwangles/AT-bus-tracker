import { Pool } from 'pg';
import { DatabaseAdapter } from './types';
import { Node, Edge, Location } from '../types';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name TEXT,
        mapImage TEXT
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id SERIAL PRIMARY KEY,
        name TEXT,
        imageUrl TEXT,
        x REAL,
        y REAL,
        z REAL,
        locationId INTEGER REFERENCES locations(id),
        mapX REAL,
        mapY REAL
      );
      
      CREATE TABLE IF NOT EXISTS edges (
        id SERIAL PRIMARY KEY,
        fromNodeId INTEGER REFERENCES nodes(id),
        toNodeId INTEGER REFERENCES nodes(id)
      );
    `);

    // Check if data exists
    const { rows } = await this.pool.query('SELECT COUNT(*) FROM locations');
    if (rows[0].count === '0') {
      // Insert sample data
      await this.pool.query(`
        INSERT INTO locations (id, name, mapImage) VALUES
        (1, 'G Block Floor 1', 'https://images.unsplash.com/photo-1524225730002-10c483114add?w=500'),
        (2, 'G Block Floor 2', 'https://images.unsplash.com/photo-1524225730002-10c483114add?w=500');
      `);

      await this.pool.query(`
        INSERT INTO nodes (id, name, imageUrl, x, y, z, locationId, mapX, mapY) VALUES
        (1, 'Entrance Hall', 'https://images.unsplash.com/photo-1531973576160-7125cd663d86', 0, 0, 0, 1, 20, 50),
        (2, 'Living Room', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c', 5, 0, 0, 1, 40, 50),
        (3, 'Kitchen', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b', 5, 0, 5, 1, 60, 50),
        (4, 'Study Room', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b', 0, 3, 0, 2, 30, 40);
      `);

      await this.pool.query(`
        INSERT INTO edges (fromNodeId, toNodeId) VALUES
        (1, 2), (2, 1),
        (2, 3), (3, 2),
        (2, 4), (4, 2);
      `);
    }
  }

  async getLocations(): Promise<Location[]> {
    const { rows } = await this.pool.query('SELECT * FROM locations');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      mapImage: row.mapimage,
    }));
  }

  async getNodes(): Promise<Node[]> {
    const { rows } = await this.pool.query('SELECT * FROM nodes');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      imageUrl: row.imageurl,
      x: row.x,
      y: row.y,
      z: row.z,
      locationId: row.locationid,
      mapX: row.mapx,
      mapY: row.mapy,
    }));
  }

  async getEdges(): Promise<Edge[]> {
    const { rows } = await this.pool.query('SELECT * FROM edges');
    return rows.map(row => ({
      id: row.id,
      fromNodeId: row.fromnodeid,
      toNodeId: row.tonodeid,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}