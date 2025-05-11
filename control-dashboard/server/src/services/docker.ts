import Docker from 'dockerode';
import { ContainerStatus } from '../types';

const docker = new Docker();

export async function getContainerStatus(): Promise<ContainerStatus[]> {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.map(container => ({
      id: container.Id,
      name: container.Names[0].replace('/', ''),
      status: container.State,
      image: container.Image
    }));
  } catch (error) {
    console.error('Error getting container status:', error);
    throw error;
  }
}

export async function startContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.start();
  } catch (error) {
    console.error('Error starting container:', error);
    throw error;
  }
}

export async function stopContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
  } catch (error) {
    console.error('Error stopping container:', error);
    throw error;
  }
} 