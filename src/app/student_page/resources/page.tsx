"use client";

import "../dashboard/styles.css";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Book, ExternalLink, Search, Filter, Bookmark, Eye, File, Video, Headphones, Upload, Trash2, Edit2 } from "lucide-react";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2";
import { useToast } from "@/contexts/ToastContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/atoms";
import ConfirmModal from "@/components/molecules/ConfirmModal";

interface Resource {
  _id: string;
  title: string;
  description: string;
  type: "pdf" | "video" | "audio" | "link" | "document";
  category: string;
  subject: string;
  url: string;
  thumbnailUrl?: string;
  author?: string;
  source?: string;
  downloads: number;
  views: number;
  bookmarkedBy: string[];
  tags: string[];
  createdAt: string;
  uploadedBy?: string;
  classId?: string;
}

interface UserClass {
  _id: string;
  name: string;
  subject: string;
  courseYear: string;
  role: "teacher" | "student";
}

export default function ResourceLibraryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [discoverMode, setDiscoverMode] = useState<'auto' | 'manual'>('auto');
  const [discoverSubject, setDiscoverSubject] = useState("");
  const [discoverCategory, setDiscoverCategory] = useState("");
  const [enrolledSubjects, setEnrolledSubjects] = useState<string[]>([]);
  // Search state for subject selection in modal
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState<boolean>(false);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState<number>(-1);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadClassId, setUploadClassId] = useState("");
  const [userClasses, setUserClasses] = useState<UserClass[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Search state for class selection in upload modal
  const [classSearch, setClassSearch] = useState<string>('');
  const [showClassDropdown, setShowClassDropdown] = useState<boolean>(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(-1);
  const classInputRef = useRef<HTMLInputElement | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9); // 9 items per page (3x3 grid)
  // Progressive loading messages
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [uploadMessageIndex, setUploadMessageIndex] = useState(0);
  // Bookmark popover state
  const [bookmarkPopoverOpen, setBookmarkPopoverOpen] = useState<string | null>(null);
  const [bookmarkAction, setBookmarkAction] = useState<'added' | 'removed'>('added');
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<{ id: string; title: string } | null>(null);
  // Current user ID from API (for bookmark checks when using JWT auth)
  const [currentUserId, setCurrentUserId] = useState<string>("");
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [resourceToEdit, setResourceToEdit] = useState<Resource | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const discoveringMessages = [
    { title: "Discovering Resources...", subtitle: "AI is searching for high-quality educational content" },
    { title: "Analyzing Sources...", subtitle: "Evaluating educational platforms and materials" },
    { title: "Validating Content...", subtitle: "Checking resource quality and accessibility" },
    { title: "Almost There...", subtitle: "Finalizing your curated resource list" },
  ];

  const uploadingMessages = [
    { title: "Uploading Resource...", subtitle: "AI is extracting metadata from the link" },
    { title: "Analyzing Content...", subtitle: "Identifying resource type and category" },
    { title: "Extracting Details...", subtitle: "Gathering title, description, and tags" },
    { title: "Finalizing...", subtitle: "Preparing your resource for the library" },
  ];

  const categoryOptions = [
    "Video Lecture",
    "Study Guide",
    "Tutorial",
    "Practice Problems",
    "Interactive Tool",
    "Course Material",
    "Reference Document",
    "Research Paper",
    "E-Book",
    "Podcast",
  ];

  useEffect(() => {
    // Check both NextAuth session and manual auth tokens
    const hasManualAuth = () => {
      if (typeof window === "undefined") return false;
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      return !!(accessToken || refreshToken);
    };

    // Only redirect if BOTH session is unauthenticated AND no manual auth tokens
    if (status === "unauthenticated" && !hasManualAuth()) {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" || (status === "unauthenticated" && typeof window !== "undefined" && localStorage.getItem("accessToken"))) {
      console.log("Fetching resources - status:", status);
      fetchResources();
      fetchEnrolledSubjects();
      fetchUserClasses();
    } else if (status === "unauthenticated") {
      console.log("Not authenticated, stopping loading");
      setLoading(false);
    }
  }, [status]);

  // Progressive loading messages for discovering
  useEffect(() => {
    if (!isDiscovering) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        if (prev < discoveringMessages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 5000); // Change message every 5 seconds

    return () => clearInterval(interval);
  }, [isDiscovering, discoveringMessages.length]);

  // Progressive loading messages for uploading
  useEffect(() => {
    if (!isUploading) {
      setUploadMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setUploadMessageIndex((prev) => {
        if (prev < uploadingMessages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 4000); // Change message every 4 seconds

    return () => clearInterval(interval);
  }, [isUploading, uploadingMessages.length]);

  const fetchEnrolledSubjects = async () => {
    try {
      console.log("Fetching enrolled subjects...");
      
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/student_page/resources/enrolled-subjects", { headers });
      console.log("Enrolled subjects response status:", res.status);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        console.log("Enrolled subjects content-type:", contentType);
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          console.log("Enrolled subjects data:", data.subjects);
          setEnrolledSubjects(data.subjects || []);
        } else {
          const text = await res.text();
          console.error("Expected JSON but got HTML:", text.substring(0, 200));
        }
      }
    } catch (error) {
      console.error("Error fetching enrolled subjects:", error);
    }
  };

  const fetchUserClasses = async () => {
    try {
      console.log("Fetching user classes...");
      
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/student_page/resources/user-classes", { headers });
      console.log("User classes response status:", res.status);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        console.log("User classes content-type:", contentType);
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          console.log("User classes data:", data.classes);
          setUserClasses(data.classes || []);
        } else {
          const text = await res.text();
          console.error("Expected JSON but got HTML:", text.substring(0, 200));
        }
      }
    } catch (error) {
      console.error("Error fetching user classes:", error);
    }
  };

  const fetchResources = async () => {
    try {
      console.log("Fetching resources...");
      
      // Get auth token if available
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/student_page/resources", { headers });
      console.log("Resources response status:", res.status);
      
      if (res.status === 401) {
        console.error("Unauthorized - redirecting to login");
        router.push("/auth/login");
        return;
      }
      
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        console.log("Resources content-type:", contentType);
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          console.log("Resources data received:", data.resources?.length || 0, "resources");
          setResources(data.resources || []);
          // Set the current user ID from API response for bookmark checks
          if (data.userId) {
            setCurrentUserId(data.userId);
          }
        } else {
          const text = await res.text();
          console.error("Expected JSON but got HTML:", text.substring(0, 200));
          showError("Failed to load resources - unexpected response format", "Load Error");
        }
      } else {
        console.error("Failed to fetch resources:", res.status, res.statusText);
        const errorText = await res.text().catch(() => "Unknown error");
        console.error("Error response:", errorText);
        showError(`Failed to load resources: ${res.status}`, "Load Error");
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
      showError("Failed to load resources - network error", "Load Error");
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async (resourceId: string, wasBookmarked: boolean) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/student_page/resources/${resourceId}/bookmark`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        fetchResources();
        // Show popover for both adding and removing bookmarks
        setBookmarkAction(wasBookmarked ? 'removed' : 'added');
        setBookmarkPopoverOpen(resourceId);
        // Auto-close popover after 2 seconds
        setTimeout(() => {
          setBookmarkPopoverOpen(null);
        }, 2000);
      }
    } catch (error) {
      console.error("Error bookmarking resource:", error);
    }
  };

  const handleView = async (resourceId: string, url: string) => {
    try {
      await fetch(`/api/student_page/resources/${resourceId}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view" }),
      });
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  const handleAutoDiscover = async () => {
    setIsDiscovering(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/student_page/resources/auto-discover", {
        method: "POST",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        
        // Immediately add the new resources to the state
        if (data.resources && data.resources.length > 0) {
          setResources(prevResources => [...data.resources, ...prevResources]);
        }
        
        showSuccess(`Discovered ${data.count} new resources for your subjects: ${data.subjects.join(", ")}`, "Resources Discovered");
        
        // Also fetch all resources to ensure we have the complete list
        await fetchResources();
      } else {
        const error = await res.json();
        showError(error.error || "Failed to discover resources", "Discovery Failed");
      }
    } catch (error) {
      console.error("Error auto-discovering resources:", error);
      showError("Failed to discover resources", "Discovery Failed");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleManualDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discoverSubject.trim()) return;

    setIsDiscovering(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/student_page/resources/discover", {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: discoverSubject,
          category: discoverCategory || undefined,
          limit: 10,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Immediately add the new resources to the state
        if (data.resources && data.resources.length > 0) {
          setResources(prevResources => [...data.resources, ...prevResources]);
        }
        
        showSuccess(`Discovered ${data.count} new resources!`, "Resources Discovered");
        
        // Also fetch all resources to ensure we have the complete list
        await fetchResources();
        
        setShowDiscoverModal(false);
        setDiscoverSubject("");
        setDiscoverCategory("");
        setSubjectSearch("");
      } else {
        const error = await res.json();
        showError(error.error || "Failed to discover resources", "Discovery Failed");
      }
    } catch (error) {
      console.error("Error discovering resources:", error);
      showError("Failed to discover resources", "Discovery Failed");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleUploadLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUrl.trim() || !uploadClassId) {
      showError("Please provide both a URL and select a class", "Missing Information");
      return;
    }

    console.log("Starting upload:", { uploadUrl, uploadClassId });
    setIsUploading(true);
    
    try {
      console.log("Sending request to API...");
      const res = await fetch("/api/student_page/resources/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: uploadUrl,
          classId: uploadClassId,
        }),
      });

      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);

      if (res.ok) {
        showSuccess(`Resource uploaded successfully: ${data.resource.title}`, "Upload Complete");
        fetchResources();
        setShowUploadModal(false);
        setUploadUrl("");
        setUploadClassId("");
        setClassSearch("");
      } else {
        console.error("Upload failed:", data);
        showError(data.error || "Failed to upload resource", "Upload Failed");
      }
    } catch (error) {
      console.error("Error uploading resource:", error);
      showError(`Failed to upload resource: ${error instanceof Error ? error.message : String(error)}`, "Upload Failed");
    } finally {
      setIsUploading(false);
    }
  };

  const openDeleteModal = (resourceId: string, resourceTitle: string) => {
    setResourceToDelete({ id: resourceId, title: resourceTitle });
    setShowDeleteModal(true);
  };

  const openEditModal = (resource: Resource) => {
    setResourceToEdit(resource);
    setEditTitle(resource.title);
    setEditDescription(resource.description);
    setEditCategory(resource.category);
    setEditTags(resource.tags.join(", "));
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceToEdit) return;

    setIsEditing(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/student_page/resources/${resourceToEdit._id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          category: editCategory,
          tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        showSuccess("Resource updated successfully", "Updated");
        fetchResources();
        setShowEditModal(false);
        setResourceToEdit(null);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          showError(data.error || "Failed to update resource", "Update Failed");
        } else {
          showError(`Failed to update resource: Server returned ${res.status}`, "Update Failed");
        }
      }
    } catch (error) {
      console.error("Error updating resource:", error);
      showError("Failed to update resource", "Update Failed");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!resourceToDelete) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/student_page/resources/${resourceToDelete.id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        showSuccess("Resource deleted successfully", "Deleted");
        fetchResources();
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          showError(data.error || "Failed to delete resource", "Delete Failed");
        } else {
          showError(`Failed to delete resource: Server returned ${res.status}`, "Delete Failed");
        }
      }
    } catch (error) {
      console.error("Error deleting resource:", error);
      showError("Failed to delete resource", "Delete Failed");
    } finally {
      setShowDeleteModal(false);
      setResourceToDelete(null);
    }
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === "all" || resource.type === filterType;
    const matchesSubject = filterSubject === "all" || resource.subject === filterSubject;
    const matchesCategory = filterCategory === "all" || resource.category === filterCategory;
    const matchesBookmark = !bookmarkedOnly || resource.bookmarkedBy.includes(currentUserId || session?.user?.id || "");

    return matchesSearch && matchesType && matchesSubject && matchesCategory && matchesBookmark;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResources = filteredResources.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterSubject, filterCategory, bookmarkedOnly]);

  const subjects = Array.from(new Set(resources.map((r) => r.subject))).filter(Boolean);
  const categories = Array.from(new Set(resources.map((r) => r.category))).filter(Boolean);

  // Filter subjects based on search input
  const filteredSubjects = enrolledSubjects.filter(subj => 
    subj.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Filter classes based on search input
  const filteredClasses = userClasses.filter(cls => 
    cls.name.toLowerCase().includes(classSearch.toLowerCase()) ||
    cls.subject.toLowerCase().includes(classSearch.toLowerCase())
  );

  // Handle subject selection from dropdown
  const handleSubjectSelect = (selectedSubject: string) => {
    setDiscoverSubject(selectedSubject);
    setSubjectSearch(selectedSubject);
    setShowSubjectDropdown(false);
    setSelectedSubjectIndex(-1);
  };

  // Handle subject search input
  const handleSubjectSearchChange = (value: string) => {
    setSubjectSearch(value);
    setDiscoverSubject(value);
    setShowSubjectDropdown(true);
    setSelectedSubjectIndex(-1);
  };

  // Handle keyboard navigation for subject dropdown
  const handleSubjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSubjectDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSubjectIndex(prev => 
          prev < filteredSubjects.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSubjectIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSubjectIndex >= 0 && selectedSubjectIndex < filteredSubjects.length) {
          handleSubjectSelect(filteredSubjects[selectedSubjectIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSubjectDropdown(false);
        setSelectedSubjectIndex(-1);
        break;
    }
  };

  // Handle class selection from dropdown
  const handleClassSelect = (classId: string) => {
    setUploadClassId(classId);
    const selectedClassObj = userClasses.find(c => c._id === classId);
    if (selectedClassObj) {
      setClassSearch(`${selectedClassObj.name} - ${selectedClassObj.subject}`);
    }
    setShowClassDropdown(false);
    setSelectedClassIndex(-1);
  };

  // Handle class search input
  const handleClassSearchChange = (value: string) => {
    setClassSearch(value);
    setShowClassDropdown(true);
    setSelectedClassIndex(-1);
  };

  // Handle keyboard navigation for class dropdown
  const handleClassKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClassDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedClassIndex(prev => 
          prev < filteredClasses.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedClassIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedClassIndex >= 0 && selectedClassIndex < filteredClasses.length) {
          handleClassSelect(filteredClasses[selectedClassIndex]._id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowClassDropdown(false);
        setSelectedClassIndex(-1);
        break;
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subjectInputRef.current && !subjectInputRef.current.contains(event.target as Node)) {
        setShowSubjectDropdown(false);
      }
      if (classInputRef.current && !classInputRef.current.contains(event.target as Node)) {
        setShowClassDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="text-red-500" size={24} />;
      case "audio":
        return <Headphones className="text-purple-500" size={24} />;
      case "pdf":
      case "document":
        return <File className="text-blue-500" size={24} />;
      case "link":
        return <ExternalLink className="text-green-500" size={24} />;
      default:
        return <Book className="text-slate-500" size={24} />;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header Card Skeleton */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
            </div>
          </div>
          
          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
              </div>
            ))}
          </div>
          
          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-slate-200 dark:bg-slate-700"></div>
                <div className="p-6">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching ai-studio style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Resource Library
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              AI-powered educational resources from across the internet
            </p>
          </div>
        </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search resources, tags, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              title="Upload Link"
              className="flex items-center justify-center w-10 h-10 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl transition-all duration-200"
            >
              <Upload size={20} />
            </button>
            <button
              onClick={() => setShowDiscoverModal(true)}
              disabled={isDiscovering}
              title={isDiscovering ? "Discovering..." : "Discover Resources"}
              className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {isDiscovering ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600/30 border-t-blue-600"></div>
              ) : (
                <Search size={20} />
              )}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              title="Filters"
              className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-all duration-200"
            >
              <Filter size={20} />
            </button>
            <button
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              title="Bookmarked"
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                bookmarkedOnly
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                  : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Bookmark size={20} className={bookmarkedOnly ? "fill-current" : ""} />
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resource Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                  <option value="link">Link</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject
                </label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {resources.length}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Resources</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {subjects.length}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Subjects</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {resources.filter(r => r.bookmarkedBy.includes(currentUserId || session?.user?.id || "")).length}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Bookmarked</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {filteredResources.length}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Filtered Results</div>
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedResources.map((resource) => {
          const isBookmarked = resource.bookmarkedBy.includes(currentUserId || session?.user?.id || "");
          const isOwner = resource.uploadedBy === (currentUserId || session?.user?.id);
          return (
            <div
              key={resource._id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
            >
              {/* Thumbnail */}
              {resource.thumbnailUrl ? (
                <div className="h-48 bg-slate-100 dark:bg-slate-700">
                  <img
                    src={resource.thumbnailUrl}
                    alt={resource.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-white text-6xl">
                    {getResourceIcon(resource.type)}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-6 flex flex-col flex-1">
                <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 flex-1">
                    {resource.title}
                  </h3>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Popover open={bookmarkPopoverOpen === resource._id} onOpenChange={(open) => {
                      if (!open) setBookmarkPopoverOpen(null);
                    }}>
                      <PopoverTrigger asChild>
                        <button
                          onClick={() => handleBookmark(resource._id, isBookmarked)}
                          className={`p-2 rounded-lg transition-colors ${
                            isBookmarked
                              ? "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30"
                              : "text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                          }`}
                        >
                          <Bookmark size={20} className={isBookmarked ? "fill-current" : ""} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-auto py-1.5 px-3 shadow-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" 
                        side="top"
                      >
                        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100 text-center whitespace-nowrap">
                          {bookmarkAction === 'added' ? 'Bookmark saved!' : 'Bookmark removed!'}
                        </p>
                      </PopoverContent>
                    </Popover>
                    {isOwner && (
                      <>
                        <button
                          onClick={() => openEditModal(resource)}
                          className="p-2 rounded-lg transition-colors text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Edit resource"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(resource._id, resource.title)}
                          className="p-2 rounded-lg transition-colors text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete resource"
                        >
                          <Trash2 size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
                  {resource.description}
                </p>

                {/* Meta Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                      {resource.subject}
                    </span>
                    <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                      {resource.category}
                    </span>
                    {resource.classId && (
                      <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                        🎓 Class Resource
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Eye size={14} /> {resource.views} views
                    </span>
                  </div>
                  {resource.author && (
                    <div className="text-xs text-slate-500">By {resource.author}</div>
                  )}
                </div>

                {/* Tags */}
                {resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {resource.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                </div>

                {/* Actions */}
                <div className="mt-4">
                  <button
                    onClick={() => handleView(resource._id, resource.url)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    {resource.type === "link" ? (
                      <>
                        <ExternalLink size={18} /> View
                      </>
                    ) : (
                      <>
                        <Eye size={18} /> View
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {filteredResources.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, current page, and pages around current
              const showPage = 
                page === 1 || 
                page === totalPages || 
                (page >= currentPage - 1 && page <= currentPage + 1);
              
              const showEllipsis = 
                (page === currentPage - 2 && currentPage > 3) ||
                (page === currentPage + 2 && currentPage < totalPages - 2);

              if (showEllipsis) {
                return (
                  <span key={page} className="px-2 text-slate-500">
                    ...
                  </span>
                );
              }

              if (!showPage) return null;

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === page
                      ? "bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white font-medium"
                      : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredResources.length === 0 && (
        <div className="text-center py-12">
          <Book className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
            No resources found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Try adjusting your search or discover new resources using AI
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowDiscoverModal(true)}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all duration-200"
            >
              Discover by Subject
            </button>
            <button
              onClick={handleAutoDiscover}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-all duration-200"
            >
              Auto-Discover
            </button>
          </div>
        </div>
      )}

      {/* Discover Modal */}
      {showDiscoverModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
              Discover Resources
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Use AI to find high-quality educational resources from the internet
            </p>
            
            <div className="space-y-3">
              {/* Auto-Discover Option */}
              <button
                type="button"
                onClick={() => setDiscoverMode('auto')}
                disabled={isDiscovering}
                className={`w-full p-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 text-left ${
                  discoverMode === 'auto'
                    ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C]'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white ${
                    discoverMode === 'auto' ? 'bg-[#2E7D32] dark:bg-[#04C40A]' : 'bg-gray-400 dark:bg-gray-600'
                  }`}>
                    <Search size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold mb-1 text-base ${
                      discoverMode === 'auto' ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-800 dark:text-slate-100'
                    }`}>
                      Auto-Discover All
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Automatically discover resources for all your enrolled subjects and classes
                    </p>
                  </div>
                </div>
              </button>

              {/* Discover by Subject Option */}
              <button
                type="button"
                onClick={() => setDiscoverMode('manual')}
                disabled={isDiscovering}
                className={`w-full p-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 text-left ${
                  discoverMode === 'manual'
                    ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C]'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white ${
                    discoverMode === 'manual' ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'
                  }`}>
                    <Filter size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold mb-1 text-base ${
                      discoverMode === 'manual' ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-800 dark:text-slate-100'
                    }`}>
                      Discover by Subject
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Choose a specific subject and category to discover targeted resources
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div id="discover-options-section" className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDiscoverModal(false)}
                disabled={isDiscovering}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (discoverMode === 'auto') {
                    setShowDiscoverModal(false);
                    await handleAutoDiscover();
                  } else {
                    // Show the form for manual discovery
                    const formSection = document.getElementById('discover-form-section');
                    if (formSection) {
                      formSection.classList.remove('hidden');
                    }
                    const optionsSection = document.getElementById('discover-options-section');
                    if (optionsSection) {
                      optionsSection.classList.add('hidden');
                    }
                  }
                }}
                disabled={isDiscovering}
                className="flex-1 px-4 py-2 bg-[#1C2B1C] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isDiscovering ? "Discovering..." : "Continue"}
              </button>
            </div>

            {/* Form Section (Hidden by default) */}
            <form id="discover-form-section" onSubmit={handleManualDiscover} className="space-y-4 hidden">
              <div className="relative" ref={subjectInputRef}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => handleSubjectSearchChange(e.target.value)}
                    onFocus={() => setShowSubjectDropdown(true)}
                    onKeyDown={handleSubjectKeyDown}
                    placeholder="Select a subject from your classes"
                    className="w-full px-4 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {showSubjectDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSubjects.length > 0 ? (
                      filteredSubjects.map((subj, index) => (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => handleSubjectSelect(subj)}
                          className={`w-full text-left px-4 py-2 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${
                            index === selectedSubjectIndex
                              ? 'bg-[#2E7D32] dark:bg-[#2E7D32] text-white font-semibold'
                              : 'bg-white dark:bg-slate-800 hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]/50 text-slate-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-[#04C40A]'
                          }`}
                        >
                          {subj}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {enrolledSubjects.length === 0 ? 'No enrolled classes found' : 'No matching classes found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category (Optional)
                </label>
                <select
                  value={discoverCategory}
                  onChange={(e) => setDiscoverCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 AI will search for real educational resources from platforms like Khan Academy, MIT OCW, Coursera, and more!
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    // Go back to options
                    const formSection = document.getElementById('discover-form-section');
                    if (formSection) {
                      formSection.classList.add('hidden');
                    }
                    const optionsSection = document.getElementById('discover-options-section');
                    if (optionsSection) {
                      optionsSection.classList.remove('hidden');
                    }
                  }}
                  disabled={isDiscovering}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isDiscovering}
                  className="flex-1 px-4 py-2 bg-[#1C2B1C] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isDiscovering ? "Discovering..." : "Discover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Link Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
              Upload Resource Link
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Share a resource with your class. AI will extract the metadata automatically!
            </p>
            <form onSubmit={handleUploadLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resource URL *
                </label>
                <input
                  type="url"
                  required
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://example.com/resource"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                />
              </div>
              <div className="relative" ref={classInputRef}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Select Class *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={classSearch}
                    onChange={(e) => handleClassSearchChange(e.target.value)}
                    onFocus={() => setShowClassDropdown(true)}
                    onKeyDown={handleClassKeyDown}
                    placeholder="Choose a class to share with"
                    className="w-full px-4 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {showClassDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredClasses.length > 0 ? (
                      filteredClasses.map((cls, index) => (
                        <button
                          key={cls._id}
                          type="button"
                          onClick={() => handleClassSelect(cls._id)}
                          className={`w-full text-left px-4 py-3 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${
                            index === selectedClassIndex
                              ? 'bg-[#2E7D32] dark:bg-[#2E7D32] text-white font-semibold'
                              : 'bg-white dark:bg-slate-800 hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]/50 text-slate-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-[#04C40A]'
                          }`}
                        >
                          <div className={`text-sm font-medium ${
                            index === selectedClassIndex
                              ? ''
                              : 'group-hover:text-[#2E7D32] dark:group-hover:text-[#04C40A]'
                          }`}>
                            {cls.name} - {cls.subject}
                          </div>
                          <div className={`text-xs mt-0.5 ${
                            index === selectedClassIndex
                              ? 'text-white/80'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {cls.courseYear} • {cls.role}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {userClasses.length === 0 ? 'No classes found' : 'No matching classes found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  🚀 AI will automatically extract the title, description, type, and other metadata from the link!
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200">
                  🌍 This resource will be shared with all students and teachers in the selected class
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Modal for Discovering */}
      {isDiscovering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col items-center gap-6">
              {/* Animated spinner */}
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#E8F5E9] dark:border-slate-800 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#2E7D32] dark:border-[#04C40A] border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              {/* Loading text with progressive messages */}
              <div className="text-center min-h-[60px] flex flex-col justify-center">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 transition-all duration-500">
                  {discoveringMessages[loadingMessageIndex].title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 transition-all duration-500">
                  {discoveringMessages[loadingMessageIndex].subtitle}
                </p>
              </div>

              {/* Progress dots animation */}
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>

              {/* Progress indicator */}
              <div className="flex gap-1.5">
                {discoveringMessages.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === loadingMessageIndex
                        ? 'w-8 bg-[#2E7D32] dark:bg-[#04C40A]'
                        : index < loadingMessageIndex
                        ? 'w-1.5 bg-[#2E7D32]/50 dark:bg-[#04C40A]/50'
                        : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal for Uploading */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col items-center gap-6">
              {/* Animated spinner */}
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#E8F5E9] dark:border-slate-800 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#2E7D32] dark:border-[#04C40A] border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              {/* Loading text with progressive messages */}
              <div className="text-center min-h-[60px] flex flex-col justify-center">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 transition-all duration-500">
                  {uploadingMessages[uploadMessageIndex].title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 transition-all duration-500">
                  {uploadingMessages[uploadMessageIndex].subtitle}
                </p>
              </div>

              {/* Progress dots animation */}
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>

              {/* Progress indicator */}
              <div className="flex gap-1.5">
                {uploadingMessages.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === uploadMessageIndex
                        ? 'w-8 bg-[#2E7D32] dark:bg-[#04C40A]'
                        : index < uploadMessageIndex
                        ? 'w-1.5 bg-[#2E7D32]/50 dark:bg-[#04C40A]/50'
                        : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setResourceToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Resource"
        message={`Are you sure you want to delete "${resourceToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
      />

      {/* Edit Resource Modal */}
      {showEditModal && resourceToEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
              Edit Resource
            </h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="e.g., math, algebra, tutorial"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setResourceToEdit(null);
                  }}
                  disabled={isEditing}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="flex-1 px-4 py-2 bg-[#1C2B1C] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isEditing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
