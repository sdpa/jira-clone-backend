import { User } from '../models/User';
import { Project } from '../models/Project';

export async function populateUser(id: string | null | undefined) {
    if (!id) return null;
    const user = await User.get(id);
    return user ? user.toJSON() : null;
}

export async function populateUsers(ids: string[]) {
    if (!ids || !Array.isArray(ids)) return [];
    const promises = ids.map(id => User.get(id));
    const users = await Promise.all(promises);
    return users.filter(u => u).map(u => u!.toJSON());
}

export async function populateProject(id: string | null | undefined) {
    if (!id) return null;
    const project = await Project.get(id);
    return project ? project.toJSON() : null;
}
