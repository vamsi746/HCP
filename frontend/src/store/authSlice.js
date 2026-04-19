import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as endpoints from "../services/endpoints";
const initialState = {
  user: null,
  loading: true,
  error: null
};
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await endpoints.login(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      if (accessToken) localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      return user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Login failed");
    }
  }
);
export const fetchMe = createAsyncThunk("auth/fetchMe", async (_, { rejectWithValue }) => {
  const token = localStorage.getItem("accessToken");
  if (!token) return rejectWithValue(null);
  try {
    const res = await endpoints.fetchMe();
    return res.data.data;
  } catch {
    return rejectWithValue(null);
  }
});
export const logout = createAsyncThunk("auth/logout", async () => {
  await endpoints.logout();
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
});
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    }).addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload;
    }).addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    }).addCase(fetchMe.pending, (state) => {
      state.loading = true;
    }).addCase(fetchMe.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload;
    }).addCase(fetchMe.rejected, (state) => {
      state.loading = false;
    }).addCase(logout.fulfilled, (state) => {
      state.user = null;
    });
  }
});
export default authSlice.reducer;
