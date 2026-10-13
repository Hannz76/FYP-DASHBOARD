import mongoose from "mongoose";

const jobSearchCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true },
  query: { q: String, location: String, employmentType: String },
  jobs: [Object],
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

export default mongoose.model("JobSearchCache", jobSearchCacheSchema);
