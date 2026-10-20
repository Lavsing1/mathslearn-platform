import { json, getAdmin } from "../../_utils.js";
export async function onRequestGet({ request, env }) {
  const admin = await getAdmin(request, env);
  return json({ authenticated: Boolean(admin), email: admin?.email || null });
}
