import Bytez from 'bytez.js';
import { logger } from '@/lib/winston';

const apiKey = process.env.GOOGLE_AI_API_KEY_Resources;
if (!apiKey) {
  throw new Error('Google AI API key for resources not configured. Set GOOGLE_AI_API_KEY_Resources');
}

const genAI = new Bytez(apiKey);

// Fallback models in order of preference
const FALLBACK_MODELS = [
  'openai/gpt-4.1',
  'openai-community/gpt2',
  'google/gemma-3-1b-it'
];

export interface DiscoveredResource {
  title: string;
  description: string;
  type: "pdf" | "video" | "audio" | "link" | "document";
  category: string;
  subject: string;
  url: string;
  thumbnailUrl?: string;
  author?: string;
  source?: string;
  tags: string[];
}

// Helper function to extract or generate thumbnail URLs
function extractThumbnail(url: string, source?: string, type?: string): string | undefined {
  try {
    const lowerUrl = url.toLowerCase();
    const lowerSource = source?.toLowerCase() || '';
    
    // YouTube video thumbnail
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      if (videoId) {
        logger.info('Extracted YouTube thumbnail', { videoId, url });
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
    
    // Coursera course thumbnail
    if (lowerUrl.includes('coursera.org') || lowerSource.includes('coursera')) {
      return 'https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera_assets.s3.amazonaws.com/images/default-course-img.png';
    }
    
    // Khan Academy
    if (lowerUrl.includes('khanacademy.org') || lowerSource.includes('khan')) {
      return 'https://cdn.kastatic.org/images/khan-logo-dark-background.png';
    }
    
    // MIT OCW
    if (lowerUrl.includes('ocw.mit.edu') || lowerSource.includes('mit ocw')) {
      return 'https://ocw.mit.edu/static_shared/images/ocw_logo_orange.png';
    }
    
    // edX
    if (lowerUrl.includes('edx.org') || lowerSource.includes('edx')) {
      return 'https://www.edx.org/images/logos/edx-logo-elm.svg';
    }
    
    // Stanford Online
    if (lowerUrl.includes('online.stanford.edu') || lowerSource.includes('stanford')) {
      return 'https://online.stanford.edu/sites/default/files/styles/figure_default/public/2018-06/stanford-online-logo.png';
    }
    
    // Udacity
    if (lowerUrl.includes('udacity.com') || lowerSource.includes('udacity')) {
      return 'https://www.udacity.com/images/svgs/udacity-tt-logo.svg';
    }
    
    // FreeCodeCamp
    if (lowerUrl.includes('freecodecamp.org') || lowerSource.includes('freecodecamp')) {
      return 'https://design-style-guide.freecodecamp.org/downloads/fcc_primary_large.png';
    }
    
    // W3Schools
    if (lowerUrl.includes('w3schools.com') || lowerSource.includes('w3schools')) {
      return 'https://www.w3schools.com/images/w3schools_green.jpg';
    }
    
    // MDN Web Docs
    if (lowerUrl.includes('developer.mozilla.org') || lowerSource.includes('mdn')) {
      return 'https://developer.mozilla.org/mdn-social-share.png';
    }
    
    // Udemy
    if (lowerUrl.includes('udemy.com') || lowerSource.includes('udemy')) {
      return 'https://www.udemy.com/staticx/udemy/images/v7/logo-udemy.svg';
    }
    
    // Harvard Online
    if (lowerUrl.includes('harvard.edu') || lowerSource.includes('harvard')) {
      return 'https://online-learning.harvard.edu/sites/default/files/styles/header/public/course/harvard-logo_0.png';
    }
    
    // Generic fallback based on type
    if (type) {
      const typeIcons: Record<string, string> = {
        video: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
        pdf: 'https://cdn-icons-png.flaticon.com/512/337/337946.png',
        document: 'https://cdn-icons-png.flaticon.com/512/3143/3143609.png',
        audio: 'https://cdn-icons-png.flaticon.com/512/3844/3844785.png',
        link: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png'
      };
      
      if (typeIcons[type]) {
        logger.info('Using type-based fallback thumbnail', { type });
        return typeIcons[type];
      }
    }
    
    logger.warn('No thumbnail found', { url, source, type });
    return undefined;
  } catch (error) {
    logger.warn('Error extracting thumbnail:', error);
    return undefined;
  }
}

export async function discoverResourcesForSubject(
  subject: string,
  category?: string,
  limit: number = 10
): Promise<DiscoveredResource[]> {
  try {
    logger.info('Discovering resources with Bytez/OpenAI GPT-4.1', {
      subject,
      category,
      limit
    });

    const prompt = `You are an educational resource curator. Find ${limit} high-quality, publicly accessible educational resources for the subject: "${subject}"${category ? ` in the category: "${category}"` : ""}.

CRITICAL REQUIREMENTS:
- ONLY provide URLs that are currently active and accessible (no 404 errors, no broken links)
- ONLY use well-established, reputable educational platforms
- Verify the URL structure is correct and complete
- Do NOT generate hypothetical or example URLs
- Do NOT use outdated or archived content

For each resource, provide:
1. Title
2. Brief description (2-3 sentences)
3. Resource type (pdf, video, audio, link, or document)
4. Actual working URL from these trusted sources ONLY:
   - Khan Academy (khanacademy.org)
   - MIT OpenCourseWare (ocw.mit.edu)
   - Coursera (coursera.org)
   - edX (edx.org)
   - YouTube Education channels (youtube.com)
   - Stanford Online (online.stanford.edu)
   - FreeCodeCamp (freecodecamp.org)
   - W3Schools (w3schools.com)
   - MDN Web Docs (developer.mozilla.org)
   - Harvard Online Learning (online-learning.harvard.edu)
5. Author/Creator name
6. Source platform (exact name from the list above)
7. 3-5 relevant tags
8. Thumbnail URL (if video, provide YouTube thumbnail; otherwise leave empty)

Focus on:
- Reputable educational platforms with stable URLs
- Free and publicly accessible content
- Currently available resources (verify URLs are active)
- High-quality, peer-reviewed or well-recognized sources
- Diverse content types (mix of videos, articles, PDFs, courses)
- Permanent links (not temporary or session-based URLs)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "title": "Resource Title",
    "description": "Brief description of the resource",
    "type": "video",
    "category": "Video Lecture",
    "subject": "${subject}",
    "url": "https://actual-working-url.com",
    "author": "Creator Name",
    "source": "Platform Name",
    "tags": ["tag1", "tag2", "tag3"],
    "thumbnailUrl": "https://thumbnail-url.com/image.jpg"
  }
]

Return ONLY the JSON array, no additional text.`;

    // Use Bytez SDK to call openai/gpt-4.1
    const model = genAI.model('openai/gpt-4.1');
    const res: any = await model.run([
      {
        role: 'user',
        content: prompt
      }
    ]);

    if (res?.error) {
      throw new Error(`Model error: ${JSON.stringify(res.error)}`);
    }

    // Normalize output - Bytez returns { output: { role: 'assistant', content: 'text' } }
    let text = '';
    const output = res?.output;
    
    if (!output) {
      text = '';
    } else if (typeof output === 'string') {
      text = output;
    } else if (typeof output === 'object' && !Array.isArray(output)) {
      if (typeof output.content === 'string') {
        text = output.content;
      } else if (typeof output.text === 'string') {
        text = output.text;
      } else if (output.message && typeof output.message.content === 'string') {
        text = output.message.content;
      }
    } else if (Array.isArray(output)) {
      for (const item of output) {
        if (!item) continue;
        if (typeof item === 'string') text += item;
        else if (typeof item === 'object') {
          if (typeof item.content === 'string') text += item.content;
          else if (typeof item.text === 'string') text += item.text;
        }
      }
    }

    logger.info('Received AI response', {
      responseLength: text.length,
      preview: text.substring(0, 200),
      hasOutput: !!output,
      outputType: typeof output
    });

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error('No valid JSON found in AI response', { text });
      throw new Error("No valid JSON found in AI response");
    }

    const resources: DiscoveredResource[] = JSON.parse(jsonMatch[0]);
    
    logger.info('Successfully parsed resources', {
      count: resources.length,
      subjects: resources.map(r => r.subject)
    });

    // Validate and clean the resources
    const validatedResources: DiscoveredResource[] = [];
    
    for (const r of resources) {
      if (!r.title || !r.url || !r.description) {
        logger.warn('Skipping resource with missing required fields', { title: r.title, url: r.url });
        continue;
      }

      // Validate URL accessibility
      const validation = await validateUrl(r.url);
      
      if (!validation.isValid) {
        logger.warn('Skipping inaccessible resource', {
          title: r.title,
          url: r.url,
          statusCode: validation.statusCode,
          error: validation.error,
        });
        continue;
      }

      // Try to extract thumbnail from URL if not provided by AI
      const thumbnail = r.thumbnailUrl || extractThumbnail(r.url, r.source, r.type);
      
      logger.info('Processing validated resource', {
        title: r.title,
        url: r.url,
        source: r.source,
        type: r.type,
        statusCode: validation.statusCode,
        hasFinalThumbnail: !!thumbnail
      });
      
      validatedResources.push({
        ...r,
        subject: subject,
        category: r.category || "General Resource",
        tags: Array.isArray(r.tags) ? r.tags : [],
        thumbnailUrl: thumbnail,
      });
    }

    logger.info('Resource validation complete', {
      totalGenerated: resources.length,
      validResources: validatedResources.length,
      invalidResources: resources.length - validatedResources.length,
    });

    return validatedResources;
  } catch (error: any) {
    logger.error('Error discovering resources:', error);
    throw new Error(error.message || "Failed to discover resources using AI");
  }
}

export async function generateResourcesForMultipleSubjects(
  subjects: string[]
): Promise<DiscoveredResource[]> {
  const allResources: DiscoveredResource[] = [];

  logger.info('Generating resources for multiple subjects', {
    subjectCount: subjects.length,
    subjects
  });

  for (const subject of subjects) {
    try {
      const resources = await discoverResourcesForSubject(subject, undefined, 5);
      allResources.push(...resources);
      
      logger.info(`Generated ${resources.length} resources for ${subject}`);
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      logger.error(`Error fetching resources for ${subject}:`, error);
    }
  }

  logger.info('Completed multi-subject resource generation', {
    totalResources: allResources.length
  });

  return allResources;
}

export async function searchResourcesByQuery(
  query: string,
  limit: number = 5
): Promise<DiscoveredResource[]> {
  try {
    logger.info('Searching resources by query with Bytez/OpenAI GPT-4.1', {
      query,
      limit
    });

    const prompt = `You are an educational resource search engine. Find ${limit} high-quality, publicly accessible educational resources related to: "${query}".

CRITICAL REQUIREMENTS:
- ONLY provide URLs that are currently active and accessible (no 404 errors, no broken links)
- ONLY use well-established, reputable educational platforms
- Verify the URL structure is correct and complete
- Do NOT generate hypothetical or example URLs
- Do NOT use outdated or archived content

For each resource, provide:
1. Title
2. Brief description
3. Resource type (pdf, video, audio, link, or document)
4. Actual working URL from these trusted sources ONLY:
   - Khan Academy, MIT OCW, Coursera, edX, YouTube Education
   - Stanford Online, FreeCodeCamp, W3Schools, MDN Web Docs
   - Harvard Online Learning
5. Author/Creator
6. Source platform (exact name from trusted sources)
7. Relevant tags
8. Thumbnail URL (if video, provide YouTube thumbnail; otherwise leave empty)

Focus on:
- Free, publicly accessible content from reputable educational platforms
- Currently available resources with stable, permanent URLs
- No broken links or 404 errors

Return ONLY a valid JSON array:
[
  {
    "title": "Resource Title",
    "description": "Description",
    "type": "video",
    "category": "Category Name",
    "subject": "Subject Name",
    "url": "https://url.com",
    "author": "Author Name",
    "source": "Platform",
    "tags": ["tag1", "tag2"],
    "thumbnailUrl": "https://thumbnail-url.com/image.jpg"
  }
]

Return ONLY the JSON array, no additional text.`;

    // Use Bytez SDK to call openai/gpt-4.1
    const model = genAI.model('openai/gpt-4.1');
    const res: any = await model.run([
      {
        role: 'user',
        content: prompt
      }
    ]);

    if (res?.error) {
      throw new Error(`Model error: ${JSON.stringify(res.error)}`);
    }

    // Normalize output - Bytez returns { output: { role: 'assistant', content: 'text' } }
    let text = '';
    const output = res?.output;
    
    if (!output) {
      text = '';
    } else if (typeof output === 'string') {
      text = output;
    } else if (typeof output === 'object' && !Array.isArray(output)) {
      if (typeof output.content === 'string') {
        text = output.content;
      } else if (typeof output.text === 'string') {
        text = output.text;
      } else if (output.message && typeof output.message.content === 'string') {
        text = output.message.content;
      }
    } else if (Array.isArray(output)) {
      for (const item of output) {
        if (!item) continue;
        if (typeof item === 'string') text += item;
        else if (typeof item === 'object') {
          if (typeof item.content === 'string') text += item.content;
          else if (typeof item.text === 'string') text += item.text;
        }
      }
    }

    logger.info('Received AI response for query', {
      responseLength: text.length,
      preview: text.substring(0, 200),
      hasOutput: !!output,
      outputType: typeof output
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error('No valid JSON found in AI response', { text });
      throw new Error("No valid JSON found in AI response");
    }

    const resources: DiscoveredResource[] = JSON.parse(jsonMatch[0]);
    
    logger.info('Successfully parsed query resources', {
      count: resources.length
    });

    const validatedResources: DiscoveredResource[] = [];
    
    for (const r of resources) {
      if (!r.title || !r.url || !r.description) {
        logger.warn('Skipping resource with missing required fields', { title: r.title, url: r.url });
        continue;
      }

      // Validate URL accessibility
      const validation = await validateUrl(r.url);
      
      if (!validation.isValid) {
        logger.warn('Skipping inaccessible query resource', {
          title: r.title,
          url: r.url,
          statusCode: validation.statusCode,
          error: validation.error,
        });
        continue;
      }

      // Try to extract thumbnail from URL if not provided by AI
      const thumbnail = r.thumbnailUrl || extractThumbnail(r.url, r.source, r.type);
      
      logger.info('Processing validated query resource', {
        title: r.title,
        url: r.url,
        source: r.source,
        type: r.type,
        statusCode: validation.statusCode,
        hasFinalThumbnail: !!thumbnail
      });
      
      validatedResources.push({
        ...r,
        thumbnailUrl: thumbnail,
      });
    }

    logger.info('Query resource validation complete', {
      totalGenerated: resources.length,
      validResources: validatedResources.length,
      invalidResources: resources.length - validatedResources.length,
    });

    return validatedResources;
  } catch (error: any) {
    logger.error('Error searching resources:', error);
    throw new Error(error.message || "Failed to search resources using AI");
  }
}

/**
 * Check if a URL contains explicit or inappropriate content
 */
export async function moderateContent(url: string): Promise<{ isAppropriate: boolean; reason?: string }> {
  try {
    logger.info('Moderating content for URL', { url });

    const prompt = `You are a content moderation system for an educational platform. Analyze this URL and determine if it contains explicit, inappropriate, or non-educational content: "${url}"

Check for:
1. Adult/explicit content (NSFW)
2. Violence or disturbing content
3. Hate speech or discriminatory content
4. Illegal or harmful content
5. Malware or phishing sites
6. Non-educational spam or commercial content

Based on the URL domain, path, and common patterns, determine if this content is appropriate for an educational setting with students of all ages.

Return ONLY a valid JSON object:
{
  "isAppropriate": true or false,
  "reason": "Brief explanation if inappropriate, empty string if appropriate"
}

Return ONLY the JSON object, no additional text.`;

    const model = genAI.model('openai/gpt-4.1');
    const res: any = await model.run([
      {
        role: 'user',
        content: prompt
      }
    ]);

    if (res?.error) {
      logger.error('Content moderation error', { error: res.error });
      // If moderation fails, be conservative and reject
      return { isAppropriate: false, reason: "Unable to verify content safety" };
    }

    // Normalize output
    let text = '';
    const output = res?.output;
    
    if (!output) {
      text = '';
    } else if (typeof output === 'string') {
      text = output;
    } else if (typeof output === 'object' && !Array.isArray(output)) {
      if (typeof output.content === 'string') {
        text = output.content;
      } else if (typeof output.text === 'string') {
        text = output.text;
      } else if (output.message && typeof output.message.content === 'string') {
        text = output.message.content;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('No valid JSON in moderation response', { text });
      return { isAppropriate: false, reason: "Unable to verify content safety" };
    }

    const result = JSON.parse(jsonMatch[0]);
    
    logger.info('Content moderation result', {
      url,
      isAppropriate: result.isAppropriate,
      reason: result.reason
    });

    return result;
  } catch (error: any) {
    logger.error('Error moderating content:', error);
    // If moderation fails, be conservative and reject
    return { isAppropriate: false, reason: "Unable to verify content safety" };
  }
}

/**
 * Validate if a URL is accessible and returns a valid response
 */
export async function validateUrl(url: string): Promise<{ isValid: boolean; statusCode?: number; error?: string }> {
  try {
    logger.info('Validating URL accessibility', { url });

    // Set a timeout for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full content
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EducationalResourceBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    const isValid = response.ok; // 200-299 status codes
    
    logger.info('URL validation result', {
      url,
      statusCode: response.status,
      isValid,
    });

    return {
      isValid,
      statusCode: response.status,
    };
  } catch (error: any) {
    logger.warn('URL validation failed', {
      url,
      error: error.message,
    });

    // If HEAD fails, try GET as fallback (some servers don't support HEAD)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EducationalResourceBot/1.0)',
        },
      });

      clearTimeout(timeoutId);

      const isValid = response.ok;
      
      logger.info('URL validation result (GET fallback)', {
        url,
        statusCode: response.status,
        isValid,
      });

      return {
        isValid,
        statusCode: response.status,
      };
    } catch (fallbackError: any) {
      logger.error('URL validation failed completely', {
        url,
        error: fallbackError.message,
      });

      return {
        isValid: false,
        error: fallbackError.message,
      };
    }
  }
}

/**
 * Extract metadata from a single link using AI
 */
export async function extractLinkMetadata(
  url: string,
  subject: string
): Promise<DiscoveredResource> {
  try {
    console.log('=== EXTRACT LINK METADATA START ===');
    console.log('URL:', url);
    console.log('Subject:', subject);
    
    // First, validate the URL is accessible
    logger.info('Validating URL before metadata extraction', { url });
    const validation = await validateUrl(url);
    
    if (!validation.isValid) {
      const errorMsg = `URL is not accessible (Status: ${validation.statusCode || 'unknown'})`;
      logger.error('URL validation failed', {
        url,
        statusCode: validation.statusCode,
        error: validation.error,
      });
      throw new Error(errorMsg);
    }
    
    logger.info('URL validated successfully', {
      url,
      statusCode: validation.statusCode,
    });
    
    logger.info('Extracting metadata from link with Bytez/OpenAI GPT-4.1', {
      url,
      subject
    });

    const prompt = `You are an educational resource analyzer. Analyze this URL and extract its metadata: "${url}"

The resource is for the subject: "${subject}"

Provide:
1. Title (descriptive title of the content)
2. Brief description (2-3 sentences about what the resource contains)
3. Resource type (pdf, video, audio, link, or document)
4. Category (e.g., "Video Lecture", "Study Guide", "Tutorial", "Practice Problems", "Interactive Tool", "Course Material", "Reference Document", "Research Paper", "E-Book", "Podcast")
5. Author/Creator name (if available, otherwise use source name)
6. Source platform (e.g., "YouTube", "Khan Academy", "MIT OCW", "Coursera", etc.)
7. 3-5 relevant tags
8. Thumbnail URL (for YouTube videos, extract video ID and use https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg; otherwise leave empty)

Based on the URL structure, domain, and common patterns, infer the metadata intelligently.

Return ONLY a valid JSON object:
{
  "title": "Resource Title",
  "description": "Brief description of the resource content",
  "type": "video",
  "category": "Video Lecture",
  "subject": "${subject}",
  "url": "${url}",
  "author": "Creator Name",
  "source": "Platform Name",
  "tags": ["tag1", "tag2", "tag3"],
  "thumbnailUrl": "https://thumbnail-url.com/image.jpg"
}

Return ONLY the JSON object, no additional text.`;

    console.log('Calling AI model...');
    // Use Bytez SDK to call openai/gpt-4.1
    const model = genAI.model('openai/gpt-4.1');
    const res: any = await model.run([
      {
        role: 'user',
        content: prompt
      }
    ]);

    console.log('AI response received:', res);

    if (res?.error) {
      console.error('Model error:', res.error);
      throw new Error(`Model error: ${JSON.stringify(res.error)}`);
    }

    // Normalize output
    let text = '';
    const output = res?.output;
    
    console.log('Output type:', typeof output);
    console.log('Output value:', output);
    
    if (!output) {
      text = '';
    } else if (typeof output === 'string') {
      text = output;
    } else if (typeof output === 'object' && !Array.isArray(output)) {
      if (typeof output.content === 'string') {
        text = output.content;
      } else if (typeof output.text === 'string') {
        text = output.text;
      } else if (output.message && typeof output.message.content === 'string') {
        text = output.message.content;
      }
    } else if (Array.isArray(output)) {
      for (const item of output) {
        if (!item) continue;
        if (typeof item === 'string') text += item;
        else if (typeof item === 'object') {
          if (typeof item.content === 'string') text += item.content;
          else if (typeof item.text === 'string') text += item.text;
        }
      }
    }

    console.log('Extracted text length:', text.length);
    console.log('Extracted text preview:', text.substring(0, 300));

    logger.info('Received AI response for link metadata', {
      responseLength: text.length,
      preview: text.substring(0, 200)
    });

    // Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in text:', text);
      logger.error('No valid JSON found in AI response', { text });
      throw new Error("No valid JSON found in AI response");
    }

    console.log('JSON match found:', jsonMatch[0].substring(0, 200));
    const metadata: DiscoveredResource = JSON.parse(jsonMatch[0]);
    console.log('Parsed metadata:', metadata);
    
    if (!metadata.title || !metadata.description) {
      console.error('Invalid metadata - missing title or description:', metadata);
      throw new Error("Invalid metadata extracted from link");
    }

    // Try to extract thumbnail from URL if not provided by AI
    const thumbnail = metadata.thumbnailUrl || extractThumbnail(url, metadata.source, metadata.type);
    console.log('Final thumbnail:', thumbnail);
    
    logger.info('Successfully extracted metadata', {
      title: metadata.title,
      type: metadata.type,
      source: metadata.source,
      hasThumbnail: !!thumbnail
    });

    const result = {
      ...metadata,
      url: url, // Ensure we use the original URL
      subject: subject, // Ensure we use the provided subject
      thumbnailUrl: thumbnail,
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    };
    
    console.log('=== EXTRACT LINK METADATA SUCCESS ===');
    console.log('Final result:', result);
    
    return result;
  } catch (error: unknown) {
    console.error('=== EXTRACT LINK METADATA ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', (error as any).message);
    console.error('Error stack:', (error as any).stack);
    logger.error('Error extracting link metadata:', error);
    throw new Error((error as any).message || "Failed to extract metadata from link");
  }
}
