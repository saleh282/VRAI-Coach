// One-off fix: older versions of evaluationModel created a unique index that
// allowed only ONE human rating per session. The model now allows one rating
// per rater, but Mongoose never removes old indexes, so a second rater gets
// "You have already evaluated this session". This drops the old index.
// Run from backend/:  npm run db:drop-old-rating-index
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const OLD_INDEX = "unique_submitted_human_evaluation";

(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing from the project .env file");
  await mongoose.connect(process.env.MONGO_URI);
  const evaluations = mongoose.connection.db.collection("evaluations");
  const names = (await evaluations.indexes()).map((index) => index.name);

  if (names.includes(OLD_INDEX)) {
    await evaluations.dropIndex(OLD_INDEX);
    console.log(`Dropped ${OLD_INDEX}. Several raters can now rate the same session.`);
  } else {
    console.log(`${OLD_INDEX} is not present. Nothing to do.`);
  }
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error("Failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
