import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongoose";
import { logger } from "@/lib/winston";
import StudyProgress, { IStudyProgress } from "@/models/study_progress";

export const GET = async (request: NextRequest, { params }: { params: Promise<{ flashcardId: string }> }) => {
  // ensure params is awaited (Next.js may provide a promise-like params)
  const { flashcardId } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId || !Types.ObjectId.isValid(userId) || !flashcardId || !Types.ObjectId.isValid(flashcardId)) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "userId and flashcardId required and must be valid" }, { status: 400 });
    }
    await connectToDatabase();
    let progress: any = await StudyProgress.findOne({ user: userId, flashcard: flashcardId }).lean();
    if (!progress) {
      // create default doc so client can reliably resume
      const created = await StudyProgress.create({ user: userId, flashcard: flashcardId });
      // created is a Mongoose document; convert to plain object only if method exists
      progress = typeof (created as any).toObject === "function" ? (created as any).toObject() : created;
    }
    
    console.log("=== GET PROGRESS RESPONSE ===");
    console.log("Returning progress:", JSON.stringify(progress, null, 2));
    if (progress?.learn?.pref) {
      console.log("Learn preferences found:", progress.learn.pref);
    }
    
    return NextResponse.json({ progress }, { status: 200 });
  } catch (err: any) {
    logger?.error?.("GET /progress error", { err });
    return NextResponse.json({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load progress" }, { status: 500 });
  }
};

export const PATCH = async (request: NextRequest, { params }: { params: Promise<{ flashcardId: string }> }) => {
  // ensure params is awaited (Next.js may provide a promise-like params)
  const { flashcardId } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId || !Types.ObjectId.isValid(userId) || !flashcardId || !Types.ObjectId.isValid(flashcardId)) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "userId and flashcardId required and must be valid" }, { status: 400 });
    }
    const body = await request.json();
    console.log("=== API PATCH REQUEST ===");
    console.log("Received body:", JSON.stringify(body, null, 2));

    // Allowed top-level keys. Include learn/match/test and flashcards so namespace updates are permitted.
    const allowed = ["starredIds", "prefs", "sessionQueue", "viewerPos", "learn", "match", "test", "lastSessionStartedAt", "flashcards"];
    const setObj: any = {};

    for (const key of allowed) {
      if (body[key] === undefined) continue;

      // If the client sent an object for nested subdocuments (learn/match/test/flashcards),
      // set its subfields individually (e.g. flashcards.starredIds -> 'flashcards.starredIds')
      // to avoid replacing the whole subdoc unintentionally.
      if ((key === "learn" || key === "match" || key === "test" || key === "flashcards") &&
          body[key] && typeof body[key] === "object" && !Array.isArray(body[key])) {
        for (const [subKey, val] of Object.entries(body[key])) {
          // Special handling for nested objects to preserve their structure
          if ((subKey === "cardOptions" || subKey === "pref") && val && typeof val === "object" && !Array.isArray(val)) {
            console.log(`Preserving nested structure for ${key}.${subKey}:`, val);
            setObj[`${key}.${subKey}`] = val;
          } else {
            setObj[`${key}.${subKey}`] = val;
          }
        }
      } else {
        // For prefs/sessionQueue/viewerPos/starredIds/lastSessionStartedAt replace as-is
        setObj[key] = body[key];
      }
    }

    console.log("Generated setObj:", JSON.stringify(setObj, null, 2));

    if (Object.keys(setObj).length === 0) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "No updatable fields provided" }, { status: 400 });
    }

    await connectToDatabase();
    
    // Special handling for cardOptions merging
    let updateOperation: any = { $set: setObj };
    
    // If we're updating cardOptions, we need to merge rather than replace
    if (setObj['learn.cardOptions']) {
      const cardOptionsToMerge = setObj['learn.cardOptions'];
      console.log("Processing cardOptions merge:", cardOptionsToMerge);
      delete setObj['learn.cardOptions']; // Remove from $set
      
      // Create individual $set operations for each cardOption
      for (const [cardId, options] of Object.entries(cardOptionsToMerge)) {
        console.log(`Setting learn.cardOptions.${cardId}:`, options);
        setObj[`learn.cardOptions.${cardId}`] = options;
      }
    }
    
    console.log("Final updateOperation:", JSON.stringify(updateOperation, null, 2));
    
    console.log("=== EXECUTING DATABASE UPDATE ===");
    console.log("Query:", { user: userId, flashcard: flashcardId });
    console.log("Update operation:", updateOperation);
    
    const updated: any = await StudyProgress.findOneAndUpdate(
      { user: userId, flashcard: flashcardId },
      updateOperation,
      { new: true, upsert: true }
    ).lean();
    
    console.log("✅ Database update successful");
    console.log("Updated document:", JSON.stringify(updated, null, 2));
    return NextResponse.json({ progress: updated }, { status: 200 });
  } catch (err: any) {
    logger?.error?.("PATCH /progress error", { err });
    return NextResponse.json({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save progress" }, { status: 500 });
  }
};