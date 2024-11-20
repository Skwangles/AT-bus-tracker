import initSqlJs from 'sql.js';
import { DatabaseAdapter } from './types';
import { Node, Edge, Location } from '../types';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: any;

  async initialize(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: file => `/dist/${file}`
    });

    this.db = new SQL.Database();

    this.db.run(`
      CREATE TABLE locations (
        id INTEGER PRIMARY KEY,
        name TEXT,
        mapImage TEXT
      );

      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY,
        name TEXT,
        imageUrl TEXT,
        x REAL,
        y REAL,
        z REAL,
        locationId INTEGER,
        mapX REAL,
        mapY REAL,
        FOREIGN KEY (locationId) REFERENCES locations(id)
      );
      
      CREATE TABLE edges (
        id INTEGER PRIMARY KEY,
        fromNodeId INTEGER,
        toNodeId INTEGER,
        FOREIGN KEY (fromNodeId) REFERENCES nodes(id),
        FOREIGN KEY (toNodeId) REFERENCES nodes(id)
      );
    `);

    // Insert sample data
    this.db.run(`
      INSERT INTO locations (id, name, mapImage) VALUES
      (1, 'G Block Floor 1', 'https://images.unsplash.com/photo-1524225730002-10c483114add?w=500'),
      (2, 'G Block Floor 2', 'https://images.unsplash.com/photo-1524225730002-10c483114add?w=500');
    `);

    this.db.run(`
      INSERT INTO nodes (id, name, imageUrl, x, y, z, locationId, mapX, mapY) VALUES
      (1, 'Entrance Hall', 'https://images.unsplash.com/photo-1531973576160-7125cd663d86', 0, 0, 0, 1, 20, 50),
      (2, 'Living Room', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c', 5, 0, 0, 1, 40, 50),
      (3, 'Kitchen', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b', 5, 0, 5, 1, 60, 50),
      (4, 'Study Room', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b', 0, 3, 0, 2, 30, 40);
    `);

    this.db.run(`
      INSERT INTO edges (fromNodeId, toNodeId) VALUES
      (1, 2), (2, 1),
      (2, 3), (3, 2),
      (2, 4), (4, 2);
    `);
  }

  async getLocations(): Promise<Location[]> {
    const result = this.db.exec('SELECT * FROM locations')[0];
    return result.values.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      mapImage: row[2] as string,
    }));
  }

  async getNodes(): Promise<Node[]> {
    const result = this.db.exec('SELECT * FROM nodes')[0];
    return result.values.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      imageUrl: row[2] as string,
      x: row[3] as number,
      y: row[4] as number,
      z: row[5] as number,
      locationId: row[6] as number,
      mapX: row[7] as number,
      mapY: row[8] as number,
    }));
  }

  async getEdges(): Promise<Edge[]> {
    const result = this.db.exec('SELECT * FROM edges')[0];
    return result.values.map(row => ({
      id: row[0] as number,
      fromNodeId: row[1] as number,
      toNodeId: row[2] as number,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}