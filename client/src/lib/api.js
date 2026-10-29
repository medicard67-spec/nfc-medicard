import axios from "axios";
import { supabase } from "./supabase.js";
import { t } from "../i18n/index.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4001/api",
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Server error messages are English; show them in the chosen language where a translation exists.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    if (data && typeof data.error === "string") data.error = t(data.error);
    return Promise.reject(err);
  }
);

export default api;
