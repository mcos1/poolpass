import mongoose from "mongoose";
import { User } from "./models/User.js";

export async function connectDb(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await repairUserIndexes();
}

async function repairUserIndexes() {
  // Earlier development builds created a normal unique email index. That index
  // treats missing/null tech emails as duplicates, so replace it with a partial
  // unique index that only applies when an email string is present.
  await User.updateMany({ email: null }, { $unset: { email: "" } });

  try {
    await User.collection.dropIndex("email_1");
  } catch (err) {
    if (err?.code !== 27) {
      throw err;
    }
  }

  await User.collection.createIndex(
    { email: 1 },
    {
      name: "email_1",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
    }
  );
}
