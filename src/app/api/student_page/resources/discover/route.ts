import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import { discoverResourcesForSubject, searchResourcesByQuery } from "@/lib/ai/resource-discovery";
import { logger } from "@/lib/winston";
import { cache } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { subject, category, query, limit } = body;

    let discoveredResources;

    if (query) {
      // Search by query
      discoveredResources = await searchResourcesByQuery(query, limit || 5);
    } else if (subject) {
      // Discover by subject
      discoveredResources = await discoverResourcesForSubject(
        subject,
        category,
        limit || 10
      );
    } else {
      return NextResponse.json(
        { error: "Either subject or query is required" },
        { status: 400 }
      );
    }

    logger.info('Discovered resources from AI', {
      count: discoveredResources.length,
      withThumbnails: discoveredResources.filter(r => r.thumbnailUrl).length,
      samples: discoveredResources.slice(0, 2).map(r => ({
        title: r.title,
        url: r.url,
        thumbnailUrl: r.thumbnailUrl,
        source: r.source
      }))
    });

    if (discoveredResources.length === 0) {
      return NextResponse.json({
        message: "No accessible resources found. The AI may have generated invalid URLs. Please try again or use a different subject/category.",
        count: 0,
        resources: [],
      });
    }

    // Save discovered resources to database
    const savedResources = [];
    for (const resource of discoveredResources) {
      try {
        // Check if resource already exists by URL
        const existing = await Resource.findOne({ url: resource.url });
        
        if (!existing) {
          logger.info('Creating new resource', {
            title: resource.title,
            hasThumbnail: !!resource.thumbnailUrl,
            thumbnailUrl: resource.thumbnailUrl
          });

          const newResource = await Resource.create({
            ...resource,
            isVerified: true, // Auto-verify AI-discovered resources
            uploadedBy: user._id, // Set the user who discovered it as the uploader
            downloads: 0,
            views: 0,
            bookmarkedBy: [],
          });
          savedResources.push(newResource);
        } else {
          logger.info('Resource already exists', {
            title: existing.title,
            hasThumbnail: !!existing.thumbnailUrl
          });
          savedResources.push(existing);
        }
      } catch (error) {
        logger.error("Error saving resource:", error);
      }
    }

    // Invalidate the cache for this user so they see the new resources immediately
    const userId = user._id.toString();
    const cacheKey = `resources:${userId}`;
    cache.delete(cacheKey);

    // Serialize ObjectIds for frontend compatibility
    const serializedResources = savedResources.map(resource => {
      const obj = resource.toObject ? resource.toObject() : resource;
      return {
        ...obj,
        _id: obj._id?.toString(),
        bookmarkedBy: obj.bookmarkedBy?.map((id: any) => id?.toString()) || [],
        uploadedBy: obj.uploadedBy?.toString() || null,
        classId: obj.classId?.toString() || null,
      };
    });

    return NextResponse.json({
      message: "Resources discovered successfully",
      count: serializedResources.length,
      resources: serializedResources,
    });
  } catch (error: any) {
    logger.error("Error discovering resources:", error);
    return NextResponse.json(
      { error: error.message || "Failed to discover resources" },
      { status: 500 }
    );
  }
}
