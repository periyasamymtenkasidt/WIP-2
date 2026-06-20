import { useState, useEffect, useRef, useMemo } from "react";
import {
  FiCheck,
  FiX,
  FiUser,
  FiAlertTriangle,
  FiMapPin,
  FiClock,
  FiFileText,
  FiPlus,
  FiDownload,
  FiTrash2,
  FiSend,
  FiEye,
  FiLock,
  FiRefreshCw,
  FiUploadCloud,
  FiCheckSquare,
  FiLayers,
  FiTrendingUp,
  FiArrowLeft,
  FiPenTool,
  FiEdit3,
  FiMap,
  FiUserCheck,
} from "react-icons/fi";
import InputField from "../../../components/InputField";
import ReusableFileUploader from "./ReusableFileUploader";
import { storeFile, getFile, deleteFile } from "../../../utils/fileStorage";
import SearchableSelect from "../../../components/SearchableSelect";
import { getRoomCategories } from "../../../data/scheduleConfig";

const PRESET_THEMES = [
  "Modern",
  "Minimalist",
  "Scandinavian",
  "Industrial",
  "Classic",
  "Bohemian",
  "Coastal",
];
const SUPERVISORS_LIST = [
  "Anand R.",
  "Vijay K.",
  "Sarah M.",
  "Priya S.",
  "Rahul G.",
];

export default function DesignWorkspace({
  site,
  onSave,
  onExpandPhoto,
  navigate,
}) {
  // 1. Initialize states from site object or defaults
  const [activeTab, setActiveTab] = useState("default-design"); // default-design, redesign, drawings, approval
  const [conceptTitle, setConceptTitle] = useState(
    site.conceptTitle || "Scandinavian Cozy Minimalist",
  );
  const [themeSelection, setThemeSelection] = useState(
    site.themeSelection || "Scandinavian",
  );
  const [designNotes, setDesignNotes] = useState(
    site.designNotes ||
      "Focusing on light oak wood tones, neutral textiles, and maximizing natural light.",
  );

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [clientNotifications, setClientNotifications] = useState(
    site.clientNotifications || [],
  );

  // Toast notifier helper
  const addNotification = (message, type = "info") => {
    const id = Date.now() + Math.random().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Real reference files upload state
  const [referenceFiles, setReferenceFiles] = useState(() => {
    if (site.referenceFiles && site.referenceFiles.length > 0)
      return site.referenceFiles;
    // Fallback: convert initial referenceImages strings to file objects
    const initialImages = site.referenceImages || [
      "/survey_living_room.png",
      "/survey_kitchen_2.png",
    ];
    return initialImages.map((img, idx) => ({
      id: `ref-init-${idx}`,
      name: img.split("/").pop() || `Reference Image ${idx + 1}.png`,
      type: (img.split(".").pop() || "PNG").toUpperCase(),
      uploadedBy: "Priya S.",
      uploadedDate: "09.06.2026",
      version: "V1",
      url: img,
      size: 1542000,
      category: idx === 0 ? "Living Room" : "Kitchen",
      versions: [
        {
          version: "V1",
          name: img.split("/").pop() || `Reference Image ${idx + 1}.png`,
          url: img,
          uploadedBy: "Priya S.",
          uploadDate: "09.06.2026",
          fileSize: "1.5 MB",
          size: 1542000,
          changeNotes: "Initial file upload sync.",
        },
      ],
    }));
  });

  // Reference File Upload Modal states
  const [showRefUploadModal, setShowRefUploadModal] = useState(false);
  const [refUploadCategory, setRefUploadCategory] = useState("");
  const [refUploadFiles, setRefUploadFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleRefDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleRefDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleRefDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleRefDropFiles = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileSelectChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
  };

  const addFilesToQueue = (files) => {
    const allowedTypes = ["JPG", "JPEG", "PNG", "WEBP", "PDF", "DOC", "DOCX"];
    const maxSizeMB = 50;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split(".").pop().toUpperCase();
      const fileSizeMB = file.size / (1024 * 1024);
      const fileId = `ref-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      // Validate type
      if (!allowedTypes.includes(extension)) {
        addNotification(`Unsupported file type: .${extension.toLowerCase()}`, "error");
        continue;
      }

      // Validate size
      if (fileSizeMB > maxSizeMB) {
        addNotification(`File size exceeds 50MB`, "error");
        continue;
      }

      // Generate preview URL
      let fileUrl = "";
      try {
        fileUrl = URL.createObjectURL(file);
      } catch (e) {
        fileUrl = "/survey_living_room.png";
      }

      const newQueuedFile = {
        id: fileId,
        file: file,
        name: file.name,
        type: extension,
        size: file.size,
        url: fileUrl,
        status: "uploading",
        progress: 0,
      };

      setRefUploadFiles((prev) => [...prev, newQueuedFile]);
      simulateUpload(newQueuedFile);
    }
  };

  const simulateUpload = (queuedFile) => {
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 25;
      setRefUploadFiles((prev) =>
        prev.map((f) => (f.id === queuedFile.id ? { ...f, progress } : f))
      );

      if (progress >= 100) {
        clearInterval(interval);
        try {
          await storeFile(queuedFile.id, queuedFile.file);
          await storeFile(`${queuedFile.id}-V1`, queuedFile.file);
        } catch (e) {
          console.error("IndexedDB store failed:", e);
        }

        setRefUploadFiles((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id ? { ...f, status: "success" } : f
          )
        );
      }
    }, 100);
  };

  const handleRemoveQueuedFile = (id) => {
    setRefUploadFiles((prev) => prev.filter((f) => f.id !== id));
    deleteFile(id);
  };

  const handleSaveReferenceFiles = (e) => {
    if (e) e.preventDefault();
    if (!refUploadCategory) {
      addNotification("Please select a category.", "error");
      return;
    }
    const successFiles = refUploadFiles.filter((f) => f.status === "success");
    if (successFiles.length === 0) {
      addNotification("Please upload at least one file.", "error");
      return;
    }

    const dateStr = new Date().toLocaleDateString("en-IN");
    const uploadedBy = site.supervisor || "Alex Sterling";

    const newFilesObjects = successFiles.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      uploadedBy: uploadedBy,
      uploadedDate: dateStr,
      category: refUploadCategory,
      version: "V1",
      size: f.size,
      url: f.url,
      versions: [
        {
          version: "V1",
          name: f.name,
          url: f.url,
          uploadedBy: uploadedBy,
          uploadDate: dateStr,
          fileSize: formatBytes(f.size),
          size: f.size,
          changeNotes: "Initial file upload.",
        },
      ],
    }));

    setReferenceFiles((prev) => [...prev, ...newFilesObjects]);
    setLastUpdatedDefaultDesign(dateStr);
    addActivity(
      `Uploaded ${successFiles.length} reference file(s) for category "${refUploadCategory}"`,
      uploadedBy,
    );
    addNotification("Reference files saved successfully", "success");

    // Reset and close
    setShowRefUploadModal(false);
    setRefUploadCategory("");
    setRefUploadFiles([]);
  };

  const isSaveDisabled =
    !refUploadCategory ||
    refUploadFiles.filter((f) => f.status === "success").length === 0;

  const [designStatus, setDesignStatus] = useState(
    site.designStatus || "In Progress",
  ); // Not Started, In Progress, Completed

  const [roomChecklist, setRoomChecklist] = useState(
    site.roomChecklist || [
      { name: "Living Room", completed: true, percentage: 80 },
      { name: "Kitchen", completed: false, percentage: 40 },
      { name: "Bedroom", completed: false, percentage: 0 },
      { name: "Bathroom", completed: false, percentage: 0 },
      { name: "Balcony", completed: false, percentage: 0 },
      { name: "Other Spaces", completed: false, percentage: 0 },
    ],
  );

  // Revisions attachments state
  const [revisions, setRevisions] = useState(() => {
    const baseRevisions = site.revisions || [
      {
        id: "rev-1",
        date: "09.06.2026",
        requestedBy: "Client (Ankit)",
        category: "Space Layout",
        description:
          "Requesting a partition between living room and dining area.",
        priority: "Medium",
        notes: "Added partition wall layout in 2D Floor Plan.",
        status: "Completed",
      },
    ];

    return baseRevisions.map((r, idx) => ({
      ...r,
      revisionNumber: r.revisionNumber || `Revision ${idx + 1}`,
      attachedFiles: r.attachedFiles || [
        {
          id: `att-init-${idx}`,
          name: "client_feedback_sketch.jpg",
          type: "JPG",
          uploadedBy: r.requestedBy || "Client (Ankit)",
          uploadedDate: r.date || "09.06.2026",
          version: "V1",
          url: "/survey_living_room.png",
          size: 450000,
          versions: [
            {
              version: "V1",
              name: "client_feedback_sketch.jpg",
              url: "/survey_living_room.png",
              uploadedBy: r.requestedBy || "Client (Ankit)",
              uploadDate: r.date || "09.06.2026",
              fileSize: "450 KB",
              size: 450000,
              changeNotes: "Initial client feedback attachment.",
            },
          ],
        },
      ],
    }));
  });

  // Drawings state with version history array
  const [drawings, setDrawings] = useState(() => {
    if (
      site.drawings &&
      site.drawings.length > 0 &&
      site.drawings[0].versions
    ) {
      return site.drawings;
    }
    const baseDrawings = site.drawings || [
      {
        id: "dr-1",
        name: "Floor Plan Layout",
        category: "2D Drawings",
        version: "V1",
        uploadedBy: "Rahul G.",
        uploadDate: "09.06.2026",
        status: "Approved",
        fileUrl: "/survey_living_room.png",
        fileSize: "1.2 MB",
        size: 1258291,
      },
      {
        id: "dr-2",
        name: "Electrical Layout",
        category: "2D Drawings",
        version: "V2",
        uploadedBy: "Rahul G.",
        uploadDate: "10.06.2026",
        status: "Under Review",
        fileUrl: "/survey_kitchen.png",
        fileSize: "1.8 MB",
        size: 1887436,
      },
      {
        id: "dr-3",
        name: "Living Room Render",
        category: "3D Drawings",
        version: "V1",
        uploadedBy: "Priya S.",
        uploadDate: "10.06.2026",
        status: "Draft",
        fileUrl: "/survey_bedroom.png",
        fileSize: "3.4 MB",
        size: 3565158,
      },
    ];

    return baseDrawings.map((d) => ({
      ...d,
      fileSize: d.fileSize || "1.5 MB",
      size: d.size || 1572864,
      reviewer: d.reviewer || "",
      reviewDate: d.reviewDate || "",
      reviewComments: d.reviewComments || "",
      versions: d.versions || [
        {
          version: d.version,
          name: d.name,
          url: d.fileUrl,
          uploadedBy: d.uploadedBy,
          uploadDate: d.uploadDate,
          fileSize: d.fileSize || "1.5 MB",
          size: d.size || 1572864,
          changeNotes: "Initial drawing upload.",
        },
      ],
    }));
  });

  const [internalComments, setInternalComments] = useState(
    site.internalComments || [
      {
        id: "c-1",
        author: "Priya S. (Designer)",
        text: "Drafted the Scandinavian theme for the living room. Let me know what you think.",
        timestamp: "09.06.2026 11:20 AM",
        isPinned: true,
        isResolved: false,
        statusNote: "Important",
        attachments: [],
        replies: [],
      },
      {
        id: "c-2",
        author: "Vijay K. (Supervisor)",
        text: "The living room electrical points look aligned with the site survey layout.",
        timestamp: "09.06.2026 02:45 PM",
        isPinned: false,
        isResolved: false,
        statusNote: "Feedback",
        attachments: [],
        replies: [],
      },
    ],
  );

  const [approvalStatus, setApprovalStatus] = useState(
    site.approvalStatus || "Pending",
  ); // Pending -> Sent -> Viewed -> Approved
  const [approvalSubmittedDate, setApprovalSubmittedDate] = useState(
    site.approvalSubmittedDate || "",
  );
  const [approvalFeedback, setApprovalFeedback] = useState(
    site.approvalFeedback || "",
  );
  const [discussionHistory, setDiscussionHistory] = useState(
    site.discussionHistory || [
      {
        author: "Client",
        text: "Please review the bathroom tile heights.",
        timestamp: "10.06.2026 04:00 PM",
      },
    ],
  );

  const [changeSummary, setChangeSummary] = useState(
    site.changeSummary ||
      "Changed floor partition specifications, updated kitchen tiles representation.",
  );

  // Activity logs
  const [activities, setActivities] = useState(
    site.activities || [
      { text: "Design Workspace initialized", time: "08.06.2026 10:00 AM" },
      {
        text: "Reference images synced from survey",
        time: "08.06.2026 02:15 PM",
      },
      { text: "Revision 1 marked as Completed", time: "09.06.2026 04:30 PM" },
    ],
  );

  // Stage Dates (Last Updated)
  const [lastUpdatedDefaultDesign, setLastUpdatedDefaultDesign] = useState(
    site.lastUpdatedDefaultDesign || "10.06.2026",
  );
  const [lastUpdatedRedesign, setLastUpdatedRedesign] = useState(
    site.lastUpdatedRedesign || "10.06.2026",
  );
  const [lastUpdatedDrawings, setLastUpdatedDrawings] = useState(
    site.lastUpdatedDrawings || "10.06.2026",
  );
  const [lastUpdatedApproval, setLastUpdatedApproval] = useState(
    site.lastUpdatedApproval || "10.06.2026",
  );

  // Client Approval Enhancements states
  const [approvalHistory, setApprovalHistory] = useState(
    site.approvalHistory || [],
  );
  const [approvalNotes, setApprovalNotes] = useState(site.approvalNotes || "");
  const [remindersSentCount, setRemindersSentCount] = useState(
    site.remindersSentCount || 0,
  );
  const [lastReminderSentDate, setLastReminderSentDate] = useState(
    site.lastReminderSentDate || "",
  );
  const [digitalAcknowledgementVerified, setDigitalAcknowledgementVerified] =
    useState(site.digitalAcknowledgementVerified || false);

  // Form states
  const [newComment, setNewComment] = useState("");
  const [commentStatusNote, setCommentStatusNote] = useState("General");
  const [commentAttachments, setCommentAttachments] = useState([]);
  const [newFeedback, setNewFeedback] = useState("");
  const [feedbackAuthor, setFeedbackAuthor] = useState("Designer");

  // Refs for auto-scrolling
  const internalCommentsBottomRef = useRef(null);
  const clientFeedbackBottomRef = useRef(null);

  // Room checklist customization states
  const [draggedRoomName, setDraggedRoomName] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoomIdx, setEditingRoomIdx] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState("");

  // Drawing name options state
  const [drawingNameOptions, setDrawingNameOptions] = useState(() => {
    const defaults = [
      "Floor Plan",
      "Furniture Layout",
      "Electrical Layout",
      "Ceiling Layout",
      "Living Room Render",
      "Kitchen Render",
      "Bedroom Render",
      "Bathroom Render",
    ];
    const existingNames = (site.drawings || []).map((d) => d.name);
    const uniqueNames = new Set([...defaults, ...existingNames]);
    return Array.from(uniqueNames);
  });
  const [showAddNewDrawNamePopover, setShowAddNewDrawNamePopover] = useState(false);
  const [newCustomDrawName, setNewCustomDrawName] = useState("");
  const [customDrawNameError, setCustomDrawNameError] = useState("");

  // Get all unique categories that currently have at least one uploaded reference file
  const categoriesWithFiles = useMemo(() => {
    const cats = new Set();
    referenceFiles.forEach((file) => {
      if (file.category) {
        cats.add(file.category);
      }
    });
    return Array.from(cats);
  }, [referenceFiles]);

  // Alert/Confirm/Prompt modal states
  const [modalAlert, setModalAlert] = useState(null);
  const [modalConfirm, setModalConfirm] = useState(null);
  const [modalPrompt, setModalPrompt] = useState(null);

  // Revision request form
  const [revCategory, setRevCategory] = useState("Space Layout");
  const [revDescription, setRevDescription] = useState("");
  const [revPriority, setRevPriority] = useState("Medium");
  const [revAffectedRooms, setRevAffectedRooms] = useState("");
  const [newRevisionAttachments, setNewRevisionAttachments] = useState([]); // Array of files currently attached to new revision request

  // Revision Selection Modal state
  const [selectedRevisionForDetails, setSelectedRevisionForDetails] =
    useState(null);

  // Drawing upload form
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [drawName, setDrawName] = useState("");
  const [drawCategory, setDrawCategory] = useState("2D Drawing");
  const [drawUploadedBy, setDrawUploadedBy] = useState("Priya S.");
  const [drawVisibleToClient, setDrawVisibleToClient] = useState(true);

  const [drawStatus, setDrawStatus] = useState("Draft");
  const [modalDrawingFile, setModalDrawingFile] = useState(null); // Uploaded file in Drawing upload modal

  // Drawing Version History Modal state
  const [selectedDrawingForHistory, setSelectedDrawingForHistory] =
    useState(null);
  const [selectedReferenceFileForHistory, setSelectedReferenceFileForHistory] =
    useState(null);

  // Drawing Review process state
  const [selectedDrawingForReview, setSelectedDrawingForReview] =
    useState(null);

  // File replacement helper states
  const [replaceTarget, setReplaceTarget] = useState(null); // { type: "default-design"|"revision-attachment"|"drawing", id, revisionId }
  const [, setTempReplacementFile] = useState(null);

  const [replacementUploading, setReplacementUploading] = useState(false);
  const [replacementProgress, setReplacementProgress] = useState(0);
  const replaceInputRef = useRef(null);

  // Collaboration comment states
  const [unreadCommentCount] = useState(2);
  const [activeReplyCommentId, setActiveReplyCommentId] = useState(null);
  const [replyText, setReplyText] = useState("");

  const [localUrls, setLocalUrls] = useState({});

  // Sync state when parent site updates (e.g. from client portal actions or site switching)
  useEffect(() => {
    if (!site) return;

    setConceptTitle((prev) =>
      prev !== site.conceptTitle
        ? site.conceptTitle || "Scandinavian Haven"
        : prev,
    );
    setThemeSelection((prev) =>
      prev !== site.themeSelection
        ? site.themeSelection || "Scandinavian"
        : prev,
    );
    setDesignNotes((prev) =>
      prev !== site.designNotes ? site.designNotes || "" : prev,
    );
    setClientNotifications((prev) =>
      JSON.stringify(prev) !== JSON.stringify(site.clientNotifications)
        ? site.clientNotifications || []
        : prev,
    );

    if (site.drawings && site.drawings.length > 0) {
      setDrawings((prev) => {
        const hasDiff =
          prev.length !== site.drawings.length ||
          prev.some((d, i) => {
            const sd = site.drawings[i];
            return (
              !sd ||
              d.status !== sd.status ||
              d.reviewer !== sd.reviewer ||
              d.reviewComments !== sd.reviewComments
            );
          });
        if (hasDiff) {
          return site.drawings.map((sd, i) => {
            const prevDraw = prev[i];
            return prevDraw ? { ...sd, notified: prevDraw.notified } : sd;
          });
        }
        return prev;
      });
    }

    setDesignStatus((prev) =>
      prev !== site.designStatus ? site.designStatus || "In Progress" : prev,
    );
    setRoomChecklist((prev) => {
      const nextList = site.roomChecklist || [];
      const updated = [...nextList];
      categoriesWithFiles.forEach((cat) => {
        if (!updated.some((r) => r.name === cat)) {
          const prevItem = prev.find((r) => r.name === cat);
          updated.push(
            prevItem || {
              name: cat,
              completed: false,
              percentage: 0,
            },
          );
        }
      });
      return JSON.stringify(prev) !== JSON.stringify(updated) ? updated : prev;
    });
    setRevisions((prev) =>
      JSON.stringify(prev) !== JSON.stringify(site.revisions)
        ? site.revisions || []
        : prev,
    );
    setInternalComments((prev) =>
      JSON.stringify(prev) !== JSON.stringify(site.internalComments)
        ? site.internalComments || []
        : prev,
    );
    setApprovalStatus((prev) =>
      prev !== site.approvalStatus ? site.approvalStatus || "Pending" : prev,
    );
    setApprovalSubmittedDate((prev) =>
      prev !== site.approvalSubmittedDate
        ? site.approvalSubmittedDate || ""
        : prev,
    );
    setApprovalFeedback((prev) =>
      prev !== site.approvalFeedback ? site.approvalFeedback || "" : prev,
    );

    setDiscussionHistory((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(site.discussionHistory)) {
        return site.discussionHistory || [];
      }
      return prev;
    });

    setChangeSummary((prev) =>
      prev !== site.changeSummary ? site.changeSummary || "" : prev,
    );

    setActivities((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(site.activities)) {
        return site.activities || [];
      }
      return prev;
    });

    setLastUpdatedDefaultDesign((prev) =>
      prev !== site.lastUpdatedDefaultDesign
        ? site.lastUpdatedDefaultDesign || "10.06.2026"
        : prev,
    );
    setLastUpdatedRedesign((prev) =>
      prev !== site.lastUpdatedRedesign
        ? site.lastUpdatedRedesign || "10.06.2026"
        : prev,
    );
    setLastUpdatedDrawings((prev) =>
      prev !== site.lastUpdatedDrawings
        ? site.lastUpdatedDrawings || "10.06.2026"
        : prev,
    );
    setLastUpdatedApproval((prev) =>
      prev !== site.lastUpdatedApproval
        ? site.lastUpdatedApproval || "10.06.2026"
        : prev,
    );
    setApprovalHistory((prev) =>
      JSON.stringify(prev) !== JSON.stringify(site.approvalHistory)
        ? site.approvalHistory || []
        : prev,
    );
    setApprovalNotes((prev) =>
      prev !== site.approvalNotes ? site.approvalNotes || "" : prev,
    );
    setRemindersSentCount((prev) =>
      prev !== site.remindersSentCount ? site.remindersSentCount || 0 : prev,
    );
    setLastReminderSentDate((prev) =>
      prev !== site.lastReminderSentDate
        ? site.lastReminderSentDate || ""
        : prev,
    );
    setDigitalAcknowledgementVerified((prev) =>
      prev !== site.digitalAcknowledgementVerified
        ? site.digitalAcknowledgementVerified || false
        : prev,
    );
  }, [site]);

  // Trigger toast notifications for newly rejected designs
  useEffect(() => {
    let updated = false;
    const nextDrawings = drawings.map((d) => {
      if (d.status === "Rejected" && !d.notified) {
        addNotification(
          `Rejection Alert - Project Site: ${site.siteID} | Asset: ${d.name} | Client: ${site.clientName} | Reason: "${d.reviewComments || "No reason"}"`,
          "error",
        );
        updated = true;
        return { ...d, notified: true };
      }
      return d;
    });
    if (updated) {
      setDrawings(nextDrawings);
    }
  }, [drawings, site.siteID, site.clientName]);

  useEffect(() => {
    const loadLocalFiles = async () => {
      const urls = { ...localUrls };
      let updated = false;

      // 1. drawings
      for (const d of drawings) {
        if (d.id && !urls[d.id]) {
          const file = await getFile(d.id);
          if (file) {
            urls[d.id] = URL.createObjectURL(file);
            updated = true;
          }
        }
        if (d.versions) {
          for (const ver of d.versions) {
            const verKey = `${d.id}-${ver.version}`;
            if (!urls[verKey]) {
              const file = await getFile(verKey);
              if (file) {
                urls[verKey] = URL.createObjectURL(file);
                updated = true;
              }
            }
          }
        }
      }

      // 2. referenceFiles
      for (const f of referenceFiles) {
        if (f.id && !urls[f.id]) {
          const file = await getFile(f.id);
          if (file) {
            urls[f.id] = URL.createObjectURL(file);
            updated = true;
          }
        }
        if (f.versions) {
          for (const ver of f.versions) {
            const verKey = `${f.id}-${ver.version}`;
            if (!urls[verKey]) {
              const file = await getFile(verKey);
              if (file) {
                urls[verKey] = URL.createObjectURL(file);
                updated = true;
              }
            }
          }
        }
      }

      // 3. revisions attachedFiles
      for (const rev of revisions) {
        if (rev.attachedFiles) {
          for (const f of rev.attachedFiles) {
            if (f.id && !urls[f.id]) {
              const file = await getFile(f.id);
              if (file) {
                urls[f.id] = URL.createObjectURL(file);
                updated = true;
              }
            }
          }
        }
      }

      // 4. internalComments attachments
      if (internalComments) {
        for (const c of internalComments) {
          if (c.attachments) {
            for (const f of c.attachments) {
              if (f.id && !urls[f.id]) {
                const file = await getFile(f.id);
                if (file) {
                  urls[f.id] = URL.createObjectURL(file);
                  updated = true;
                }
              }
            }
          }
        }
      }

      // 5. discussionHistory attachments
      if (discussionHistory) {
        for (const c of discussionHistory) {
          if (c.attachments) {
            for (const f of c.attachments) {
              if (f.id && !urls[f.id]) {
                const file = await getFile(f.id);
                if (file) {
                  urls[f.id] = URL.createObjectURL(file);
                  updated = true;
                }
              }
            }
          }
        }
      }

      if (updated) {
        setLocalUrls(urls);
      }
    };
    loadLocalFiles();
  }, [
    drawings,
    referenceFiles,
    revisions,
    internalComments,
    discussionHistory,
  ]);

  // Auto-save message indicator
  const [saveStatus, setSaveStatus] = useState("Draft Saved");

  // Helper to format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to log an activity
  const addActivity = (text, user = "Vijay K. (Supervisor)") => {
    const time =
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " " +
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    setActivities((prev) => [{ text: `${text} by ${user}`, time }, ...prev]);
  };


  // Ensure every category with files exists in the master roomChecklist state
  useEffect(() => {
    setRoomChecklist((prev) => {
      let changed = false;
      const updated = [...prev];
      categoriesWithFiles.forEach((cat) => {
        if (!updated.some((r) => r.name === cat)) {
          updated.push({
            name: cat,
            completed: false,
            percentage: 0,
          });
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [categoriesWithFiles]);

  // Only display categories that currently have reference files
  const visibleRoomChecklist = useMemo(() => {
    return roomChecklist.filter((room) => categoriesWithFiles.includes(room.name));
  }, [roomChecklist, categoriesWithFiles]);

  // Toggle checklist item
  const handleToggleChecklist = (roomName) => {
    setRoomChecklist((prev) =>
      prev.map((item) =>
        item.name === roomName
          ? {
              ...item,
              completed: !item.completed,
              percentage: !item.completed ? 100 : 0,
            }
          : item,
      ),
    );
  };

  // Set individual room progress
  const handleRoomProgressChange = (roomName, pct) => {
    const value = Math.max(0, Math.min(100, Number(pct)));
    setRoomChecklist((prev) =>
      prev.map((item) =>
        item.name === roomName
          ? { ...item, percentage: value, completed: value === 100 }
          : item,
      ),
    );
  };

  // Overall Room-wise completion average
  const roomCompletionAverage =
    visibleRoomChecklist.length === 0
      ? 0
      : Math.round(
          visibleRoomChecklist.reduce((sum, r) => sum + r.percentage, 0) /
            visibleRoomChecklist.length,
        );

  // STAGE 1 (Default Design) Completion check
  const isDefaultDesignValid =
    conceptTitle.trim() !== "" &&
    designNotes.trim() !== "" &&
    referenceFiles.length >= 1 &&
    roomCompletionAverage === 100;

  // Auto-completion for Default Design
  useEffect(() => {
    if (isDefaultDesignValid && designStatus !== "Completed") {
      const timer = setTimeout(() => {
        setDesignStatus("Completed");
        addActivity("Default Design stage automatically completed", "System");
        addNotification("Default Design stage Completed!", "success");
      }, 0);
      return () => clearTimeout(timer);
    } else if (!isDefaultDesignValid && designStatus === "Completed") {
      const timer = setTimeout(() => {
        setDesignStatus("In Progress");
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefaultDesignValid]);

  // Load/Restore blob URLs from IndexedDB on mount
  useEffect(() => {
    let active = true;
    const restoreUrls = async () => {
      const restoreFileArray = async (filesArray) => {
        if (!filesArray) return [];
        return Promise.all(
          filesArray.map(async (file) => {
            const storedFile = await getFile(file.id);
            let updatedUrl = file.url || file.fileUrl;
            let updatedVersions = file.versions || [];

            if (storedFile) {
              updatedUrl = URL.createObjectURL(storedFile);
            }

            if (file.versions && file.versions.length > 0) {
              updatedVersions = await Promise.all(
                file.versions.map(async (v) => {
                  const versionFile = await getFile(`${file.id}-${v.version}`);
                  let vUrl = v.url;
                  if (versionFile) {
                    vUrl = URL.createObjectURL(versionFile);
                  }
                  return { ...v, url: vUrl };
                }),
              );
            }

            const res = { ...file, versions: updatedVersions };
            if (file.url !== undefined) res.url = updatedUrl;
            if (file.fileUrl !== undefined) res.fileUrl = updatedUrl;
            return res;
          }),
        );
      };

      const restoredReferenceFiles = await restoreFileArray(referenceFiles);

      const restoredRevisions = await Promise.all(
        revisions.map(async (rev) => {
          const restoredAttached = await restoreFileArray(rev.attachedFiles);
          return { ...rev, attachedFiles: restoredAttached };
        }),
      );

      const restoredDrawings = await Promise.all(
        drawings.map(async (draw) => {
          const restoredVersions = await Promise.all(
            (draw.versions || []).map(async (v) => {
              const versionFile = await getFile(`${draw.id}-${v.version}`);
              let vUrl = v.url;
              if (versionFile) {
                vUrl = URL.createObjectURL(versionFile);
              }
              return { ...v, url: vUrl };
            }),
          );
          const latestVersionFile = await getFile(`${draw.id}-${draw.version}`);
          let fileUrl = draw.fileUrl;
          if (latestVersionFile) {
            fileUrl = URL.createObjectURL(latestVersionFile);
          }
          return { ...draw, fileUrl, versions: restoredVersions };
        }),
      );

      if (active) {
        setReferenceFiles(restoredReferenceFiles);
        setRevisions(restoredRevisions);
        setDrawings(restoredDrawings);
      }
    };

    restoreUrls();
    return () => {
      active = false;
    };
  }, []);

  // Auto-scroll for Internal Comments
  useEffect(() => {
    if (internalCommentsBottomRef.current) {
      internalCommentsBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [internalComments]);

  // Auto-scroll for Client Feedback
  useEffect(() => {
    if (clientFeedbackBottomRef.current) {
      clientFeedbackBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [discussionHistory]);

  // Drag and Drop Handlers
  const handleDragStart = (e, roomName) => {
    setDraggedRoomName(roomName);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetRoomName) => {
    e.preventDefault();
    if (draggedRoomName === null || draggedRoomName === targetRoomName) return;
    setRoomChecklist((prev) => {
      const updatedList = [...prev];
      const draggedIdx = updatedList.findIndex((r) => r.name === draggedRoomName);
      const targetIdx = updatedList.findIndex((r) => r.name === targetRoomName);
      if (draggedIdx === -1 || targetIdx === -1) return prev;

      const [draggedItem] = updatedList.splice(draggedIdx, 1);
      updatedList.splice(targetIdx, 0, draggedItem);
      return updatedList;
    });
    setDraggedRoomName(null);
    addActivity(
      "Reordered room checklist items",
      site.supervisor || "Alex Sterling",
    );
  };

  // STAGE 2 (Redesign) Completion check
  const redesignStageStatus = (() => {
    if (revisions.length === 0) return "Completed";
    const allCompleted = revisions.every(
      (r) =>
        r.status === "Completed" &&
        r.attachedFiles &&
        r.attachedFiles.length > 0,
    );
    if (allCompleted) return "Completed";
    const anyInProgress = revisions.some((r) => r.status === "In Progress");
    if (anyInProgress) return "In Progress";
    return "Pending";
  })();

  // Drawings Stage Completion check (all uploaded drawings must be approved)
  const isDrawingsStageCompleted =
    drawings.length > 0 && drawings.every((d) => d.status === "Approved");

  // Smart Progress Calculation
  const defaultDesignProgress = Math.round(
    (conceptTitle.trim() !== "" ? 10 : 0) +
      (themeSelection ? 5 : 0) +
      (designNotes.trim() !== "" ? 15 : 0) +
      (referenceFiles.length >= 1 ? 20 : 0) +
      roomCompletionAverage * 0.5,
  );

  const redesignProgress =
    revisions.length === 0
      ? 100
      : Math.round(
          (revisions.filter((r) => r.status === "Completed").length /
            revisions.length) *
            100,
        );

  const drawingsProgress =
    drawings.length === 0
      ? 0
      : Math.round(
          (drawings.filter((d) => d.status === "Approved").length /
            drawings.length) *
            100,
        );

  const getApprovalProgressVal = (status) => {
    if (status === "Approved") return 100;
    if (status === "Viewed") return 66;
    if (status === "Sent") return 33;
    return 0;
  };
  const approvalProgress = getApprovalProgressVal(approvalStatus);

  const overallDesignProgress = Math.round(
    revisions.length > 0
      ? (defaultDesignProgress +
          redesignProgress +
          drawingsProgress +
          approvalProgress) /
          4
      : (defaultDesignProgress + drawingsProgress + approvalProgress) / 3,
  );

  // Save site details with compatibility sync
  useEffect(() => {
    let active = true;
    const imageUrls = referenceFiles
      .filter((f) =>
        ["PNG", "JPG", "JPEG", "WEBP"].includes(f.type.toUpperCase()),
      )
      .map((f) => f.url);

    const saveTimer = setTimeout(() => {
      if (active) setSaveStatus("Saving...");
    }, 0);

    const updated = {
      ...site,
      conceptTitle,
      themeSelection,
      designNotes,
      referenceImages: imageUrls,
      referenceFiles,
      designStatus,
      roomChecklist,
      revisions,
      drawings,
      internalComments,
      approvalStatus,
      approvalSubmittedDate,
      approvalFeedback,
      discussionHistory,
      changeSummary,
      activities,
      lastUpdatedDefaultDesign,
      lastUpdatedRedesign,
      lastUpdatedDrawings,
      lastUpdatedApproval,
      approvalHistory,
      approvalNotes,
      remindersSentCount,
      lastReminderSentDate,
      digitalAcknowledgementVerified,
      progress: overallDesignProgress,
      clientNotifications,
    };
    onSave(updated);

    const timer = setTimeout(() => {
      if (active) setSaveStatus("All changes saved");
    }, 400);

    return () => {
      active = false;
      clearTimeout(saveTimer);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    conceptTitle,
    themeSelection,
    designNotes,
    referenceFiles,
    designStatus,
    roomChecklist,
    revisions,
    drawings,
    internalComments,
    approvalStatus,
    approvalSubmittedDate,
    approvalFeedback,
    discussionHistory,
    changeSummary,
    activities,
    lastUpdatedDefaultDesign,
    lastUpdatedRedesign,
    lastUpdatedDrawings,
    lastUpdatedApproval,
    approvalHistory,
    approvalNotes,
    remindersSentCount,
    lastReminderSentDate,
    digitalAcknowledgementVerified,
    overallDesignProgress,
    clientNotifications,
  ]);

  // Determine current stage index
  const getCurrentStageIndex = () => {
    if (approvalStatus === "Approved") return 4;
    if (designStatus === "Completed") {
      const hasPendingRevisions =
        revisions.length > 0 &&
        !revisions.every((r) => r.status === "Completed");
      if (hasPendingRevisions) return 1;
      if (!isDrawingsStageCompleted) return 2;
      return 3;
    }
    return 0;
  };

  const currentStageIndex = getCurrentStageIndex();

  const handleTabClick = (tabKey) => {
    if (tabKey === "drawings" && designStatus !== "Completed") {
      setModalAlert({
        message:
          "Default Design must be completed (Submit for Review) before entering 2D/3D Drawings stage.",
      });
      return;
    }
    if (tabKey === "approval" && designStatus !== "Completed") {
      setModalAlert({
        message:
          "Default Design must be completed before entering Client Approval stage.",
      });
      return;
    }
    if (tabKey === "approval" && !isDrawingsStageCompleted) {
      setModalAlert({
        message: "All uploaded drawings must be reviewed and approved first.",
      });
      return;
    }
    setActiveTab(tabKey);
  };

  // Submit Default Design for Review
  const handleSubmitDefaultDesign = () => {
    if (!isDefaultDesignValid) {
      let msg = "Cannot submit Default Design. ";
      if (conceptTitle.trim() === "") msg += "Concept Title is missing. ";
      if (designNotes.trim() === "") msg += "Design Notes are missing. ";
      if (referenceFiles.length === 0)
        msg += "At least one reference file is required. ";
      if (roomCompletionAverage < 100)
        msg += "Room checklist must be 100% complete. ";
      setModalAlert({ message: msg });
      return;
    }
    setDesignStatus("Completed");
    setLastUpdatedDefaultDesign(new Date().toLocaleDateString("en-IN"));
    addActivity(
      "Default Design submitted for review",
      site.supervisor || "Alex Sterling",
    );
    addNotification("Default Design Submitted!", "success");
    setActiveTab("drawings");
  };

  // Add revision attachment handler
  const handleNewRevisionAttachmentSuccess = (fileObj) => {
    setNewRevisionAttachments((prev) => [...prev, fileObj]);
  };

  // Submit a new revision request
  const handleSubmitRevision = (e) => {
    e.preventDefault();
    if (!revDescription.trim()) return;

    const dateStr = new Date().toLocaleDateString("en-IN");
    const newRev = {
      id: `rev-${Date.now()}`,
      date: dateStr,
      requestedBy: "Client (Ankit)",
      category: revCategory,
      description: revDescription,
      priority: revPriority,
      affectedRooms: revAffectedRooms,
      notes: "Awaiting designer response.",
      resolutionNotes: "",
      status: "Pending",
      attachedFiles: newRevisionAttachments,
      revisionNumber: `Revision ${revisions.length + 1}`,
    };

    setRevisions((prev) => [...prev, newRev]);
    setNewRevisionAttachments([]);
    setRevAffectedRooms("");
    setLastUpdatedRedesign(dateStr);
    addActivity(
      `New Revision Request submitted: ${revCategory} (${revPriority})`,
      "Client (Ankit)",
    );
    addNotification("New Revision Request Added!", "info");
    setRevDescription("");
  };

  // Update a revision status
  const handleUpdateRevisionStatus = (id, newStatus) => {
    const today = new Date().toLocaleDateString("en-IN");
    const completedByUser = "Priya S. (Designer)";

    setRevisions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const isCompleted = newStatus === "Completed";
          return {
            ...r,
            status: newStatus,
            completedDate: isCompleted ? today : r.completedDate,
            completedBy: isCompleted ? completedByUser : r.completedBy,
          };
        }
        return r;
      }),
    );
    setLastUpdatedRedesign(new Date().toLocaleDateString("en-IN"));
    addActivity(
      `Revision status updated to ${newStatus}`,
      "Priya S. (Designer)",
    );
    addNotification(`Revision marked as ${newStatus}`, "success");

    const targetRev = revisions.find((r) => r.id === id);
    const revNum = targetRev ? targetRev.revisionNumber : "";
    let clientNotifTitle = "";
    let clientNotifText = "";
    let clientNotifType = "info";

    if (newStatus === "In Progress") {
      clientNotifTitle = "Revision Started";
      clientNotifText = `The design team has started work on Revision ${revNum}.`;
      clientNotifType = "info";
    } else if (newStatus === "Completed") {
      clientNotifTitle = "Revision Completed";
      clientNotifText = `Revision ${revNum} has been completed. Review the updated files.`;
      clientNotifType = "success";
    }

    if (clientNotifTitle) {
      const newNotif = {
        id: `notif-${Date.now()}`,
        title: clientNotifTitle,
        text: clientNotifText,
        type: clientNotifType,
        timestamp:
          new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }) +
          " " +
          new Date().toLocaleDateString("en-IN"),
        read: false,
      };
      setClientNotifications((prev) => [...prev, newNotif]);
    }
  };

  // Delete revision attachment handler
  const handleDeleteRevisionAttachment = (revId, fileId) => {
    setRevisions((prev) =>
      prev.map((r) => {
        if (r.id === revId) {
          return {
            ...r,
            attachedFiles: r.attachedFiles.filter((f) => f.id !== fileId),
          };
        }
        return r;
      }),
    );
    deleteFile(fileId);
    addActivity(
      `Deleted attachment in revision ${revId}`,
      "Priya S. (Designer)",
    );
  };

  // Add internal comment
  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment = {
      id: `c-${Date.now()}`,
      author: "Vijay K. (Supervisor)",
      text: newComment,
      timestamp:
        new Date().toLocaleDateString("en-IN") +
        " " +
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      statusNote: commentStatusNote,
      attachments: commentAttachments,
      isPinned: false,
      isResolved: false,
      replies: [],
    };

    setInternalComments((prev) => [...prev, comment]);
    setNewComment("");
    setCommentAttachments([]);
    setCommentStatusNote("General");
    addActivity("Internal team comment posted", "Vijay K. (Supervisor)");
    addNotification("Comment posted", "success");
  };

  const handleTogglePinComment = (id) => {
    setInternalComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)),
    );
    addActivity("Toggled pin status on comment", "Vijay K. (Supervisor)");
  };

  const handleToggleResolveComment = (id) => {
    setInternalComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              isResolved: !c.isResolved,
              statusNote: !c.isResolved ? "Resolved" : "General",
            }
          : c,
      ),
    );
    addActivity(
      "Toggled resolve status on discussion thread",
      "Vijay K. (Supervisor)",
    );
  };

  const handleAddReply = (commentId) => {
    if (!replyText.trim()) return;
    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setInternalComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const currentReplies = c.replies || [];
          return {
            ...c,
            replies: [
              ...currentReplies,
              {
                id: `rep-${c.id}-${currentReplies.length + 1}`,
                author: "Vijay K. (Supervisor)",
                text: replyText,
                timestamp: timeStr,
              },
            ],
          };
        }
        return c;
      }),
    );
    addActivity("Replied to comment thread", "Vijay K. (Supervisor)");
    setReplyText("");
    setActiveReplyCommentId(null);
  };

  // Add client discussion feedback
  const handleAddClientFeedback = (e) => {
    e.preventDefault();
    if (!newFeedback.trim()) return;

    const comment = {
      author: feedbackAuthor,
      text: newFeedback,
      timestamp:
        new Date().toLocaleDateString("en-IN") +
        " " +
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
    };

    setDiscussionHistory((prev) => [...prev, comment]);
    setNewFeedback("");
    addActivity(`${feedbackAuthor} feedback comment added`, feedbackAuthor);
  };

  // Submit design for client approval
  const handleSendForApproval = () => {
    if (!isDrawingsStageCompleted) {
      setModalAlert({
        message:
          "Cannot submit for approval. All uploaded drawings must be reviewed and approved.",
      });
      return;
    }
    const today = new Date().toLocaleDateString("en-IN");
    setApprovalStatus("Sent");
    setApprovalSubmittedDate(today);
    setLastUpdatedApproval(today);

    // Save submission to approvalHistory
    const submission = {
      id: `sub-${Date.now()}`,
      date: today,
      submittedBy: "Priya S. (Designer)",
      notes: approvalNotes || "Latest drawings packages and site revisions.",
      status: "Sent",
    };
    setApprovalHistory((prev) => [...prev, submission]);

    addActivity(
      "Design package submitted for Client Approval",
      "Priya S. (Designer)",
    );
    addNotification("Approval package sent to client!", "success");
  };

  // Simulate client viewed
  const handleClientViewed = () => {
    const today = new Date().toLocaleDateString("en-IN");
    setApprovalStatus("Viewed");
    setLastUpdatedApproval(today);
    setApprovalHistory((prev) =>
      prev.map((s, idx) =>
        idx === prev.length - 1 ? { ...s, status: "Viewed" } : s,
      ),
    );
    addActivity("Client viewed the submitted design package", "Client");
    addNotification("Client viewed design package", "info");
  };

  // Approve design
  const handleApproveDesign = () => {
    const today = new Date().toLocaleDateString("en-IN");
    setApprovalStatus("Approved");
    setDigitalAcknowledgementVerified(true);
    setLastUpdatedApproval(today);
    setApprovalHistory((prev) =>
      prev.map((s, idx) =>
        idx === prev.length - 1 ? { ...s, status: "Approved" } : s,
      ),
    );
    addActivity("Design package Approved by client", "Client");
    addNotification("Design Package Approved!", "success");
  };

  // Client requests changes (redirects to Redesign)
  const handleRequestChanges = () => {
    setModalPrompt({
      message: "Please enter changes requested by client:",
      onConfirm: (feedback) => {
        const today = new Date().toLocaleDateString("en-IN");
        setApprovalStatus("Pending");
        setApprovalFeedback(feedback || "Client requested modifications.");
        setApprovalHistory((prev) =>
          prev.map((s, idx) =>
            idx === prev.length - 1 ? { ...s, status: "Changes Requested" } : s,
          ),
        );

        // Auto-create redesign revision request
        const newRev = {
          id: `rev-${Date.now()}`,
          date: today,
          requestedBy: "Client (via Approval Tab)",
          category: "Theme/Color",
          description:
            feedback ||
            "Feedback from approval stage: requested design revisions.",
          priority: "High",
          notes: "Created automatically from client approval feedback.",
          resolutionNotes: "",
          status: "Pending",
          revisionNumber: `Revision ${revisions.length + 1}`,
          attachedFiles: [],
        };

        setRevisions((prev) => [...prev, newRev]);
        setLastUpdatedApproval(today);
        setLastUpdatedRedesign(today);
        addActivity(
          "Client requested revisions. Design redirected to Redesign.",
          "Client",
        );
        addNotification("Client requested revision changes.", "warning");

        setActiveTab("redesign");
        setModalAlert({
          message:
            "Design status set to 'Changes Requested'. Redirecting to Redesign tab to fulfill request.",
        });
      },
    });
  };

  // Reject design
  const handleRejectDesign = () => {
    setApprovalStatus("Pending");
    setApprovalHistory((prev) =>
      prev.map((s, idx) =>
        idx === prev.length - 1 ? { ...s, status: "Rejected" } : s,
      ),
    );
    addActivity("Design package Rejected by client", "Client");
    addNotification("Design package rejected by client.", "error");
  };

  // Client approval reminder
  const handleSendReminder = () => {
    const today = new Date().toLocaleDateString("en-IN");
    setRemindersSentCount((prev) => prev + 1);
    setLastReminderSentDate(today);
    addActivity(
      "Sent design approval reminder to client",
      "Vijay K. (Supervisor)",
    );
    addNotification("Approval reminder sent to client!", "success");
  };

  // Transition to In Progress / Execution
  const handleMoveToExecution = () => {
    if (approvalStatus !== "Approved") {
      setModalAlert({
        message: "Design must be Approved before moving to Execution.",
      });
      return;
    }
    // Set site's status to In Progress
    const updated = {
      ...site,
      status: "In Progress",
      progress: 75,
      designStatus: "Completed",
      notes:
        "Design stage completed and approved. Project transitioned to Site Execution phase.",
    };
    onSave(updated);
    addActivity(
      "Project moved to site Execution / In Progress",
      "Vijay K. (Supervisor)",
    );
    window.location.reload();
  };
  // Drawing Version Helper
  const incrementVersion = (currentVer) => {
    const match = currentVer.match(/V(\d+)/i);
    if (match) {
      const num = parseInt(match[1]) + 1;
      return `V${num}`;
    }
    return "V2";
  };

  const handleSaveCustomDrawingName = () => {
    const trimmed = newCustomDrawName.trim();
    if (!trimmed) {
      setCustomDrawNameError("Drawing name cannot be empty.");
      return;
    }
    const exists = drawingNameOptions.some(
      (opt) => opt.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setCustomDrawNameError("Drawing Name already exists.");
      return;
    }

    setDrawingNameOptions((prev) => [...prev, trimmed]);
    setDrawName(trimmed);
    setShowAddNewDrawNamePopover(false);
    setNewCustomDrawName("");
    setCustomDrawNameError("");
    addNotification(`Drawing name "${trimmed}" added and selected.`, "success");
  };

  // Drawing Upload Handler (with Name duplicate check for versioning)
  const handleUploadDrawing = async (e) => {
    e.preventDefault();
    if (!drawName.trim() || !modalDrawingFile) return;

    const dateStr = new Date().toLocaleDateString("en-IN");
    const existingDrawing = drawings.find(
      (d) => d.name.toLowerCase().trim() === drawName.toLowerCase().trim(),
    );

    const rawFile = await getFile(modalDrawingFile.id);

    if (existingDrawing) {
      const nextVer = incrementVersion(existingDrawing.version);

      if (rawFile) {
        await storeFile(`${existingDrawing.id}-${nextVer}`, rawFile);
        await storeFile(existingDrawing.id, rawFile);
      }

      const newVerObj = {
        version: nextVer,
        name: modalDrawingFile.name,
        url: modalDrawingFile.url,
        uploadedBy: drawUploadedBy || "Alex Sterling",
        uploadDate: dateStr,
        fileSize: formatBytes(modalDrawingFile.size),
        size: modalDrawingFile.size,
        changeNotes: "Uploaded new drawing version.",
      };

      setDrawings((prev) =>
        prev.map((d) =>
          d.id === existingDrawing.id
            ? {
                ...d,
                version: nextVer,
                fileUrl: modalDrawingFile.url,
                fileSize: formatBytes(modalDrawingFile.size),
                size: modalDrawingFile.size,
                uploadDate: dateStr,
                status: drawStatus,
                visibleToClient: drawVisibleToClient,
                versions: [...(d.versions || []), newVerObj],
              }
            : d,
        ),
      );
      addActivity(
        `Uploaded version ${nextVer} of drawing "${drawName}"`,
        drawUploadedBy,
      );
      addNotification(`New version uploaded for ${drawName}`, "success");
    } else {
      const newDrawId = `dr-${Date.now()}`;
      if (rawFile) {
        await storeFile(`${newDrawId}-V1`, rawFile);
        await storeFile(newDrawId, rawFile);
      }

      const newDraw = {
        id: newDrawId,
        name: drawName,
        category: drawCategory === "2D Drawing" ? "2D Drawings" : "3D Drawings",
        version: "V1",
        uploadedBy: drawUploadedBy || "Priya S.",
        uploadDate: dateStr,
        status: drawStatus,
        fileUrl: modalDrawingFile.url,
        fileSize: formatBytes(modalDrawingFile.size),
        size: modalDrawingFile.size,
        reviewer: "",
        reviewDate: "",
        reviewComments: "",
        visibleToClient: drawVisibleToClient,
        versions: [
          {
            version: "V1",
            name: modalDrawingFile.name,
            url: modalDrawingFile.url,
            uploadedBy: drawUploadedBy || "Priya S.",
            uploadDate: dateStr,
            fileSize: formatBytes(modalDrawingFile.size),
            size: modalDrawingFile.size,
            changeNotes: "Initial version upload.",
          },
        ],
      };
      setDrawings((prev) => [...prev, newDraw]);
      addActivity(`Uploaded new drawing: ${drawName} (V1)`, drawUploadedBy);
      addNotification(`Drawing ${drawName} uploaded`, "success");
    }

    setDrawName("");
    setModalDrawingFile(null);
    setShowUploadModal(false);
    setShowAddNewDrawNamePopover(false);
    setNewCustomDrawName("");
    setCustomDrawNameError("");
    setLastUpdatedDrawings(dateStr);
  };

  // Replacement file trigger click
  const handleReplaceFileClick = (type, id, revisionId = null) => {
    setReplaceTarget({ type, id, revisionId });
    if (replaceInputRef.current) {
      replaceInputRef.current.value = ""; // Force change event even if same file
      replaceInputRef.current.click();
    }
  };

  // File replacement handling
  const handleReplaceFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0 || !replaceTarget)
      return;
    const file = e.target.files[0];
    const extension = file.name.split(".").pop().toUpperCase();
    const fileSizeMB = file.size / (1024 * 1024);

    let allowed = [];
    let maxSize = 50;

    if (replaceTarget.type === "default-design") {
      allowed = ["JPG", "PNG", "WEBP", "PDF", "DOC", "DOCX"];
    } else if (replaceTarget.type === "revision-attachment") {
      allowed = ["PDF", "DOC", "DOCX", "JPG", "PNG", "ZIP"];
    } else if (replaceTarget.type === "drawing") {
      allowed = ["DWG", "DXF", "SKP", "PDF", "JPG", "PNG", "JPEG", "MP4"];
    }

    if (allowed.length > 0 && !allowed.includes(extension)) {
      setModalAlert({
        message: `Unsupported file type: .${extension.toLowerCase()}. Supported for this category: ${allowed.join(", ")}`,
      });
      setReplaceTarget(null);
      return;
    }

    if (fileSizeMB > maxSize) {
      setModalAlert({
        message: `File size exceeds limit of ${maxSize}MB (Selected file: ${fileSizeMB.toFixed(1)}MB)`,
      });
      setReplaceTarget(null);
      return;
    }

    // Prompt for Change Notes
    setTempReplacementFile(file);
    setModalPrompt({
      message: `Enter change notes for replacing file with "${file.name}":`,
      onConfirm: (notes) => {
        completeFileReplacement(file, notes || "Uploaded new version.");
      },
      onCancel: () => {
        setReplaceTarget(null);
        setTempReplacementFile(null);
      },
    });
  };

  const completeFileReplacement = async (file, notes) => {
    const extension = file.name.split(".").pop().toUpperCase();

    // Show upload progress
    setReplacementUploading(true);
    setReplacementProgress(0);

    let progress = 0;
    const interval = setInterval(async () => {
      progress += 20;
      setReplacementProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);

        const fileUrl = URL.createObjectURL(file);
        const dateStr = new Date().toLocaleDateString("en-IN");
        const uploadedBy = site.supervisor || "Alex Sterling";

        if (replaceTarget.type === "default-design") {
          const targetFile = referenceFiles.find(
            (f) => f.id === replaceTarget.id,
          );
          const currentVer = targetFile
            ? parseInt(targetFile.version.replace("V", "")) || 1
            : 1;
          const nextVer = `V${currentVer + 1}`;

          await storeFile(replaceTarget.id, file);
          await storeFile(`${replaceTarget.id}-${nextVer}`, file);

          setReferenceFiles((prev) =>
            prev.map((f) => {
              if (f.id === replaceTarget.id) {
                const newVerObj = {
                  version: nextVer,
                  name: file.name,
                  url: fileUrl,
                  uploadedBy,
                  uploadDate: dateStr,
                  fileSize: formatBytes(file.size),
                  size: file.size,
                  changeNotes: notes,
                };
                return {
                  ...f,
                  version: nextVer,
                  name: file.name,
                  type: extension,
                  url: fileUrl,
                  size: file.size,
                  uploadedDate: dateStr,
                  versions: [...(f.versions || []), newVerObj],
                };
              }
              return f;
            }),
          );
          setLastUpdatedDefaultDesign(dateStr);
          addActivity(
            `Replaced reference file: ${file.name} (${notes})`,
            uploadedBy,
          );
          addNotification("Reference file replaced", "success");
        } else if (replaceTarget.type === "revision-attachment") {
          await storeFile(replaceTarget.id, file);
          let nextVer = "V2";
          const targetRev = revisions.find(
            (r) => r.id === replaceTarget.revisionId,
          );
          if (targetRev) {
            const targetAtt = targetRev.attachedFiles.find(
              (att) => att.id === replaceTarget.id,
            );
            if (targetAtt) {
              const currentVer =
                parseInt(targetAtt.version.replace("V", "")) || 1;
              nextVer = `V${currentVer + 1}`;
            }
          }
          await storeFile(`${replaceTarget.id}-${nextVer}`, file);

          setRevisions((prev) =>
            prev.map((r) => {
              if (r.id === replaceTarget.revisionId) {
                const updatedAttachments = r.attachedFiles.map((att) => {
                  if (att.id === replaceTarget.id) {
                    const newVerObj = {
                      version: nextVer,
                      name: file.name,
                      url: fileUrl,
                      uploadedBy,
                      uploadDate: dateStr,
                      fileSize: formatBytes(file.size),
                      size: file.size,
                      changeNotes: notes,
                    };
                    return {
                      ...att,
                      version: nextVer,
                      name: file.name,
                      type: extension,
                      url: fileUrl,
                      size: file.size,
                      uploadedDate: dateStr,
                      versions: [...(att.versions || []), newVerObj],
                    };
                  }
                  return att;
                });
                return { ...r, attachedFiles: updatedAttachments };
              }
              return r;
            }),
          );
          setLastUpdatedRedesign(dateStr);
          addActivity(
            `Replaced revision attachment in revision ID ${replaceTarget.revisionId} (${notes})`,
            uploadedBy,
          );
          addNotification("Revision attachment replaced", "success");
        } else if (replaceTarget.type === "drawing") {
          const targetDrawing = drawings.find((d) => d.id === replaceTarget.id);
          const currentVer = targetDrawing
            ? parseInt(targetDrawing.version.replace("V", "")) || 1
            : 1;
          const nextVer = `V${currentVer + 1}`;

          await storeFile(replaceTarget.id, file);
          await storeFile(`${replaceTarget.id}-${nextVer}`, file);

          setDrawings((prev) =>
            prev.map((d) => {
              if (d.id === replaceTarget.id) {
                const newVerObj = {
                  version: nextVer,
                  name: file.name,
                  url: fileUrl,
                  uploadedBy,
                  uploadDate: dateStr,
                  fileSize: formatBytes(file.size),
                  size: file.size,
                  changeNotes: notes,
                };
                return {
                  ...d,
                  version: nextVer,
                  fileUrl: fileUrl,
                  fileSize: formatBytes(file.size),
                  size: file.size,
                  uploadDate: dateStr,
                  status: "Under Review",
                  versions: [...(d.versions || []), newVerObj],
                };
              }
              return d;
            }),
          );
          setLastUpdatedDrawings(dateStr);
          addActivity(
            `Uploaded new drawing version for drawing ID ${replaceTarget.id} (${notes})`,
            uploadedBy,
          );
          addNotification("New drawing version uploaded", "success");
        }

        setReplacementUploading(false);
        setReplaceTarget(null);
        setTempReplacementFile(null);
      }
    }, 100);
  };

  // Helper to render user mentions in comment text
  const renderCommentText = (text) => {
    if (!text) return "";
    const parts = text.split(/(@\w+(?:\s+\w+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={i}
            className="text-select-blue font-bold bg-blue-50 px-1 rounded"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Drawing review submission handler
  const handleReviewDrawingSubmit = (reviewer, comments, status) => {
    if (!selectedDrawingForReview) return;
    const dateStr = new Date().toLocaleDateString("en-IN");
    setDrawings((prev) =>
      prev.map((d) => {
        if (d.id === selectedDrawingForReview.id) {
          return {
            ...d,
            reviewer,
            reviewComments: comments,
            reviewDate: dateStr,
            status: status,
          };
        }
        return d;
      }),
    );
    addActivity(
      `Reviewed drawing "${selectedDrawingForReview.name}": Set status to ${status}`,
      reviewer,
    );
    addNotification(
      `Drawing marked as ${status}`,
      status === "Approved" ? "success" : "warning",
    );
    setSelectedDrawingForReview(null);
  };

  // Determine Current stage label
  const STAGES = [
    "Default Design",
    "Redesign",
    "2D/3D Drawings",
    "Client Approval",
    "Execution",
  ];
  const currentStageLabel = STAGES[currentStageIndex];

  // Save Draft explicitly
  const handleSaveDraft = () => {
    setSaveStatus("Saving...");
    const imageUrls = referenceFiles
      .filter((f) =>
        ["PNG", "JPG", "JPEG", "WEBP"].includes(f.type.toUpperCase()),
      )
      .map((f) => f.url);

    const updated = {
      ...site,
      conceptTitle,
      themeSelection,
      designNotes,
      referenceImages: imageUrls,
      referenceFiles,
      designStatus,
      roomChecklist,
      revisions,
      drawings,
      internalComments,
      approvalStatus,
      approvalSubmittedDate,
      approvalFeedback,
      discussionHistory,
      changeSummary,
      activities,
      lastUpdatedDefaultDesign,
      lastUpdatedRedesign,
      lastUpdatedDrawings,
      lastUpdatedApproval,
      approvalHistory,
      approvalNotes,
      remindersSentCount,
      lastReminderSentDate,
      digitalAcknowledgementVerified,
      progress: overallDesignProgress,
    };
    onSave(updated);
    setTimeout(() => {
      setSaveStatus("All changes saved");
      setModalAlert({ message: "Draft saved successfully!" });
    }, 400);
  };

  // Submit Stage explicitly based on active tab
  const handleSubmitStage = () => {
    if (activeTab === "default-design") {
      handleSubmitDefaultDesign();
    } else if (activeTab === "redesign") {
      if (redesignStageStatus !== "Completed") {
        setModalAlert({
          message:
            "Redesign stage cannot be submitted. All revision requests must be resolved and have uploaded resolution files.",
        });
        return;
      }
      addActivity(
        "Redesign stage completed",
        site.supervisor || "Alex Sterling",
      );
      setLastUpdatedRedesign(new Date().toLocaleDateString("en-IN"));
      setActiveTab("drawings");
      setModalAlert({
        message: "Redesign stage completed! Navigated to Drawings stage.",
      });
    } else if (activeTab === "drawings") {
      if (!isDrawingsStageCompleted) {
        setModalAlert({
          message:
            "Cannot submit Drawings stage. All uploaded drawings must be reviewed and approved.",
        });
        return;
      }
      addActivity(
        "Drawings stage submitted",
        site.supervisor || "Alex Sterling",
      );
      setLastUpdatedDrawings(new Date().toLocaleDateString("en-IN"));
      setActiveTab("approval");
      setModalAlert({
        message:
          "Drawings stage submitted successfully! Navigated to Client Approval stage.",
      });
    } else if (activeTab === "approval") {
      handleSendForApproval();
    }
  };

  const getScopeValue = () => {
    const preset = site.propertyPreset || "";
    const siteType = site.siteType || "Residential";
    const formattedPreset = preset
      ? preset.replace(/^(\d+)(BHK)$/i, "$1 BHK")
      : "";
    return formattedPreset ? `${formattedPreset} / ${siteType}` : siteType;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative select-none">
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={handleReplaceFileChange}
      />

      {/* Header Section */}
      <div className="flex justify-between items-center mb-6 shrink-0 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sitevisit")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border hover:bg-gray-50 hover:border-select-blue/30 text-gray-500 hover:text-select-blue transition-all shadow-sm cursor-pointer"
            title="Go back to Sites"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[26px] font-bold text-darkgray leading-tight">
              Design Workspace
            </h1>
            <p className="text-[13px] text-gray-500 mt-1 font-semibold">
              {site.siteID} • {site.clientName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-muted hover:bg-bg-soft hover:text-darkgray transition-all shadow-sm cursor-pointer bg-white"
          >
            Save Draft
          </button>
          <button
            onClick={handleSubmitStage}
            className="px-5 py-2.5 bg-select-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-950 shadow-sm transition-all cursor-pointer"
          >
            Submit Stage
          </button>
        </div>
      </div>

      {/* Project Summary Strip */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] shrink-0">
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Site ID
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {site.siteID}
          </span>
        </div>
        <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Client
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {site.clientName}
          </span>
        </div>
        <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Scope
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {getScopeValue()}
          </span>
        </div>
        <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Property Type
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {site.propertyType || site.siteType || "Residential"}
          </span>
        </div>
        <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Current Stage
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {currentStageLabel}
          </span>
        </div>
        <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Progress
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {overallDesignProgress}%
          </span>
        </div>
        <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex flex-col">
          <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
            Target Date
          </span>
          <span className="font-semibold text-darkgray mt-0.5">
            {site.targetDate || "31-12-2026"}
          </span>
        </div>
      </div>

      {/* Workflow Progress Section (Design Stage Stepper) */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between shrink-0 flex-wrap lg:flex-nowrap gap-4">
        {/* Stepper Steps (stretched to fill space) */}
        <div className="flex items-center py-1 flex-1 min-w-0 overflow-x-auto scroll-hidden-bar">
          {[
            { key: "default-design", line1: "Default", line2: "Design" },
            { key: "redesign", line1: "Redesign", line2: "" },
            { key: "drawings", line1: "2D/3D", line2: "Drawings" },
            { key: "approval", line1: "Client", line2: "Approval" },
            { key: "execution", line1: "Execution", line2: "" },
          ].map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isActive = idx === currentStageIndex;
            const isLocked = idx > currentStageIndex;

            return (
              <div
                key={stage.key}
                className="flex items-center flex-1 last:flex-none"
              >
                {/* Step Node */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      isCompleted
                        ? "bg-select-blue text-white"
                        : isActive
                          ? "bg-select-blue text-white ring-4 ring-select-blue/20"
                          : "bg-gray-50 border border-gray-200 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <FiCheck size={14} />
                    ) : isLocked ? (
                      <FiLock size={11} className="text-gray-400" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Text Label */}
                  <div
                    className={`flex flex-col text-[10px] font-bold leading-tight select-none ${
                      isCompleted
                        ? "text-dark-blue"
                        : isActive
                          ? "text-select-blue"
                          : "text-gray-400"
                    }`}
                  >
                    <span>{stage.line1}</span>
                    {stage.line2 && <span>{stage.line2}</span>}
                  </div>
                </div>

                {/* Connecting Line (except for the last step) */}
                {idx < 4 && (
                  <div className="flex-1 mx-2 md:mx-4 shrink-0 min-w-[16px]">
                    <div
                      className={`transition-all ${
                        idx < currentStageIndex
                          ? "h-[3px] w-full bg-select-blue rounded"
                          : "h-[1.5px] w-full bg-gray-200"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Status Pill */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200 whitespace-nowrap shadow-xs shrink-0">
          <FiRefreshCw
            size={11}
            className={
              saveStatus === "Saving..."
                ? "animate-spin text-select-blue"
                : "text-emerald-500"
            }
          />
          <span>{saveStatus}</span>
        </div>
      </div>

      {/* Design Notifications / Rejections Alert Panel */}
      {drawings.some((d) => d.status === "Rejected") && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 mb-4 flex flex-col gap-2 shadow-xs shrink-0 text-xs text-left">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <FiAlertTriangle className="shrink-0 text-rose-500" size={16} />
            <span>Design Rejections Detected</span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {drawings
              .filter((d) => d.status === "Rejected")
              .map((d) => (
                <div
                  key={d.id}
                  className="bg-white/60 p-2.5 rounded-lg border border-rose-100/50 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <span className="font-bold text-rose-950">
                      Asset Name: <span className="underline">{d.name}</span>{" "}
                      (Version {d.version})
                    </span>
                    <span className="text-[10px] text-rose-600 font-bold bg-rose-100/50 px-1.5 py-0.5 rounded">
                      Rejected by {d.reviewer || "Client"}
                    </span>
                  </div>
                  {d.reviewDate && (
                    <span className="text-[9px] text-gray-400 font-medium">
                      Date & Time: {d.reviewDate}
                    </span>
                  )}
                  {d.reviewComments && (
                    <p className="text-[11px] text-rose-900/80 italic font-semibold mt-1">
                      Reason: "{d.reviewComments}"
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Two-Column Grid Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full lg:items-stretch lg:overflow-hidden min-h-0">
        {/* Left Column: Main Navigation & Page Active Tab Contents (2/3 width) */}
        <div className="w-full lg:w-2/3 flex flex-col min-w-0 lg:h-full overflow-hidden">
          {/* Main Navigation Tabs */}
          <div className="sticky top-0 z-20 bg-overallbg pb-4 shrink-0">
            <div className="flex gap-3 relative z-30 flex-wrap">
              {[
                {
                  key: "default-design",
                  label: "Default Design",
                  icon: FiPenTool,
                  isLocked: false,
                },
                {
                  key: "redesign",
                  label: "Redesign",
                  icon: FiEdit3,
                  isLocked: designStatus !== "Completed",
                },
                {
                  key: "drawings",
                  label: "2D / 3D Drawing",
                  icon: FiMap,
                  isLocked: designStatus !== "Completed",
                },
                {
                  key: "approval",
                  label: "Client Approval",
                  icon: FiUserCheck,
                  isLocked:
                    designStatus !== "Completed" || !isDrawingsStageCompleted,
                },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabClick(tab.key)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer whitespace-nowrap shadow-xs ${
                      isActive
                        ? "bg-select-blue text-white border-select-blue"
                        : tab.isLocked
                          ? "bg-[#f1f3f6] text-gray-400 border-gray-250/60 cursor-not-allowed"
                          : "bg-white text-darkgray hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <TabIcon
                      size={14}
                      className={
                        isActive
                          ? "text-white"
                          : tab.isLocked
                            ? "text-gray-400/80"
                            : "text-darkgray/80"
                      }
                    />
                    <span>{tab.label}</span>
                    {tab.isLocked && (
                      <FiLock
                        size={12}
                        className="text-gray-400 shrink-0 ml-0.5"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Container for Active Tab Contents */}
          <div className="flex-1 overflow-y-auto scroll-hidden-bar pr-1 pb-8 pt-4 space-y-6">
            {/* TAB 1: DEFAULT DESIGN */}
            {activeTab === "default-design" && (
              <div className="space-y-6">
                {/* Design Concepts Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Design Concepts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <InputField
                      label="Design Name"
                      value={conceptTitle}
                      onChange={(e) => setConceptTitle(e.target.value)}
                      placeholder="Enter design name"
                    />
                    <div className="flex flex-col">
                      <label className="mb-1 text-[11px] font-semibold text-darkgray">
                        Theme
                      </label>
                      <select
                        value={themeSelection}
                        onChange={(e) => setThemeSelection(e.target.value)}
                        className="bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2.5 focus:outline-none focus:border-gray-300 cursor-pointer"
                      >
                        {PRESET_THEMES.map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-darkgray mb-1">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      value={designNotes}
                      onChange={(e) => setDesignNotes(e.target.value)}
                      className="w-full text-[11px] bg-light-gray border border-bordergray rounded-md p-3 focus:outline-none focus:border-gray-300 resize-none"
                      placeholder="Describe design choices, color palette, materials..."
                    />
                  </div>
                </div>
                {/* Reference Files Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray">
                      Reference Files
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRefUploadModal(true)}
                      className="flex items-center gap-1.5 bg-linear-to-r from-select-blue to-dark-blue hover:from-blue-950 hover:to-blue-900 text-white rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer hover:shadow-select-blue/30 hover:scale-[1.02] transition-all"
                    >
                      <FiPlus size={13} />
                      <span>Upload Files</span>
                    </button>
                  </div>
                  <div className="border-b border-gray-100 mb-4" />

                  {(() => {
                    const categories = getRoomCategories();
                    const allUniqueCategories = Array.from(new Set([
                      ...categories,
                      ...referenceFiles.map((f) => f.category).filter(Boolean),
                    ]));

                    const categoriesWithFiles = allUniqueCategories.filter((catName) =>
                      referenceFiles.some((f) => f.category === catName)
                    );

                    if (categoriesWithFiles.length > 0) {
                      return (
                        <div className="space-y-6">
                          {categoriesWithFiles.map((catName) => {
                            const files = referenceFiles.filter((f) => f.category === catName);
                            return (
                              <div key={catName} className="border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-150">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-select-blue animate-pulse" />
                                    <span className="text-xs font-bold text-darkgray uppercase tracking-wider">{catName || "Uncategorized"}</span>
                                    <span className="text-[10px] text-gray-400 bg-white border border-gray-150 px-1.5 py-0.2 rounded font-bold">
                                      {files.length} {files.length === 1 ? "file" : "files"}
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs text-darkgray bg-white">
                                    <thead>
                                      <tr className="bg-palewhite/40 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[9px]">
                                        <th className="p-3 pl-4">File Name</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Uploaded By</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3 text-center pr-4">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {files.map((file) => (
                                        <tr
                                          key={file.id}
                                          className="hover:bg-palewhite/30 transition-colors"
                                        >
                                          <td
                                            className="p-3 pl-4 font-bold text-gray-800 truncate max-w-[200px]"
                                            title={file.name}
                                          >
                                            {file.name}
                                          </td>
                                          <td className="p-3 font-semibold text-gray-500 uppercase">
                                            {file.type}
                                          </td>
                                          <td className="p-3 font-semibold text-gray-500">
                                            {file.uploadedBy}
                                          </td>
                                          <td className="p-3 text-gray-400 font-semibold">
                                            {file.uploadedDate}
                                          </td>
                                          <td className="p-3 text-center pr-4">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <button
                                                onClick={() => {
                                                  const ext = file.type.toLowerCase();
                                                  const fileUrl =
                                                    localUrls[file.id] || file.url;
                                                  if (
                                                    ["png", "jpg", "jpeg", "webp"].includes(
                                                      ext,
                                                    )
                                                  ) {
                                                    onExpandPhoto([fileUrl], 0, file.name);
                                                  } else {
                                                    window.open(fileUrl, "_blank");
                                                  }
                                                }}
                                                className="p-1.5 hover:text-select-blue bg-white border border-gray-200 hover:border-select-blue rounded transition-all cursor-pointer"
                                                title="View"
                                              >
                                                <FiEye size={12} />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const a = document.createElement("a");
                                                  a.href = localUrls[file.id] || file.url;
                                                  a.download = file.name;
                                                  document.body.appendChild(a);
                                                  a.click();
                                                  document.body.removeChild(a);
                                                }}
                                                className="p-1.5 hover:text-emerald-600 bg-white border border-gray-200 hover:border-emerald-600 rounded transition-all cursor-pointer"
                                                title="Download"
                                              >
                                                <FiDownload size={12} />
                                              </button>
                                              <button
                                                onClick={() =>
                                                  handleReplaceFileClick(
                                                    "default-design",
                                                    file.id,
                                                  )
                                                }
                                                className="p-1.5 hover:text-amber-600 bg-white border border-gray-200 hover:border-amber-600 rounded transition-all cursor-pointer animate-all"
                                                title="Replace"
                                              >
                                                <FiRefreshCw size={12} />
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setSelectedReferenceFileForHistory(file)
                                                }
                                                className="p-1.5 hover:text-blue-500 bg-white border border-gray-200 hover:border-blue-500 rounded transition-all cursor-pointer"
                                                title="Version History"
                                              >
                                                <FiClock size={12} />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setModalConfirm({
                                                    message: `Are you sure you want to delete reference file "${file.name}"?`,
                                                    onConfirm: () => {
                                                      setReferenceFiles((prev) =>
                                                        prev.filter(
                                                          (f) => f.id !== file.id,
                                                        ),
                                                      );
                                                      deleteFile(file.id);
                                                      addActivity(
                                                        `Deleted reference file: ${file.name}`,
                                                        site.supervisor || "Alex Sterling",
                                                      );
                                                    },
                                                  });
                                                }}
                                                className="p-1.5 hover:text-red-500 bg-white border border-gray-200 hover:border-red-500 rounded transition-all cursor-pointer"
                                                title="Delete"
                                              >
                                                <FiTrash2 size={12} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } else {
                      return (
                        <p className="text-xs text-gray-400 italic text-center py-4 bg-palewhite rounded-xl border border-gray-100">
                          No reference files uploaded yet. (At least 1 file required
                          to complete default design)
                        </p>
                      );
                    }
                  })()}
                </div>
                {/* Room-wise Design Checklist Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4 flex-wrap gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray">
                      Room-wise Design Checklist
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${roomCompletionAverage === 100 ? "text-emerald-700 bg-emerald-50" : "text-select-blue bg-blue-50"}`}
                      >
                        {roomCompletionAverage}% Average Completion
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleRoomChecklist.map((room) => {
                      const isDraggedOver = draggedRoomName === room.name;
                      return (
                        <div
                          key={room.name}
                          draggable
                          onDragStart={(e) => handleDragStart(e, room.name)}
                          onDragOver={(e) => handleDragOver(e)}
                          onDrop={(e) => handleDrop(e, room.name)}
                          className={`p-3 border border-gray-100 bg-palewhite rounded-xl flex flex-col gap-2 transition-all hover:shadow-xs cursor-move relative ${
                            isDraggedOver ? "border-select-blue opacity-50" : ""
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={room.completed}
                                onChange={() => handleToggleChecklist(room.name)}
                                className="w-4 h-4 text-select-blue rounded border-gray-300 focus:ring-select-blue cursor-pointer shrink-0"
                              />
                              <span className="text-xs font-bold text-darkgray truncate">
                                {room.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
                                {room.percentage}% Done
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="10"
                              value={room.percentage}
                              onChange={(e) =>
                                handleRoomProgressChange(room.name, e.target.value)
                              }
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-select-blue"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {visibleRoomChecklist.length === 0 && (
                      <div className="col-span-full py-6 text-center text-xs text-gray-400 italic bg-palewhite rounded-xl border border-gray-100">
                        No rooms in checklist. Upload reference files to automatically generate checklist items.
                      </div>
                    )}
                  </div>
                </div>
                {/* Design Status Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex justify-between items-center flex-wrap gap-4 text-left">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-darkgray mb-1">
                      Design Status Tracker
                    </h4>
                    <p className="text-[11px] text-gray-400 font-semibold">
                      Change status of initial design proposal creation.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {["Not Started", "In Progress", "Completed"].map(
                      (status) => (
                        <button
                          key={status}
                          disabled={
                            status === "Completed" && !isDefaultDesignValid
                          }
                          onClick={() => setDesignStatus(status)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:bg-gray-150 disabled:text-gray-450 disabled:border-gray-200 disabled:cursor-not-allowed ${
                            designStatus === status
                              ? "bg-select-blue text-white border-select-blue"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {status}
                        </button>
                      ),
                    )}
                    <button
                      onClick={handleSubmitDefaultDesign}
                      className="ml-3 flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <FiSend size={12} />
                      Submit for Review
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REDESIGN */}
            {activeTab === "redesign" && (
              <div className="space-y-6">
                {/* Revision History Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Revision History
                  </h3>
                  {revisions.length > 0 ? (
                    <div className="max-h-[300px] overflow-y-auto border border-gray-100 rounded-xl scroll-hidden-bar">
                      <table className="w-full text-left text-xs text-darkgray cursor-pointer">
                        <thead className="sticky top-0 bg-palewhite z-10">
                          <tr className="bg-palewhite border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-3">Revision</th>
                            <th className="p-3">Requested By</th>
                            <th className="p-3">Affected Rooms</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Created Date</th>
                            <th className="p-3">Completed Date</th>
                            <th className="p-3">Completed By</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {revisions.map((rev) => (
                            <tr
                              key={rev.id}
                              onClick={() => setSelectedRevisionForDetails(rev)}
                              className="hover:bg-palewhite/50 transition-colors"
                            >
                              <td className="p-3 font-bold">
                                {rev.revisionNumber || `Revision`}
                              </td>
                              <td className="p-3 font-semibold text-gray-500">
                                {rev.requestedBy}
                              </td>
                              <td className="p-3 font-semibold text-gray-500">
                                {rev.affectedRooms || "All Rooms"}
                              </td>
                              <td className="p-3 font-bold text-gray-500">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] ${rev.priority === "High" || rev.priority === "Critical" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-650"}`}
                                >
                                  {rev.priority}
                                </span>
                              </td>
                              <td className="p-3 text-gray-400 font-semibold">
                                {rev.date}
                              </td>
                              <td className="p-3 text-gray-400 font-semibold">
                                {rev.completedDate || "—"}
                              </td>
                              <td className="p-3 text-gray-500 font-bold">
                                {rev.completedBy || "—"}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                    rev.status === "Completed"
                                      ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                      : "bg-amber-50 border-amber-100 text-amber-700"
                                  }`}
                                >
                                  {rev.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-4 bg-palewhite rounded-xl border border-gray-100">
                      No redesign/revision requests submitted yet.
                    </p>
                  )}
                </div>

                {/* Revision Request Form */}
                <form
                  onSubmit={handleSubmitRevision}
                  className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left"
                >
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Revision Request
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col">
                      <label className="mb-1 text-[11px] font-semibold text-darkgray">
                        Reason
                      </label>
                      <select
                        value={revCategory}
                        onChange={(e) => setRevCategory(e.target.value)}
                        className="bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2.5 focus:outline-none cursor-pointer"
                      >
                        {[
                          "Space Layout",
                          "Electrical/Plumbing",
                          "Theme/Color",
                          "Furniture",
                          "Lighting",
                          "Other",
                        ].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-[11px] font-semibold text-darkgray">
                        Priority
                      </label>
                      <select
                        value={revPriority}
                        onChange={(e) => setRevPriority(e.target.value)}
                        className="bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2.5 focus:outline-none cursor-pointer"
                      >
                        {["Low", "Medium", "High", "Critical"].map((pr) => (
                          <option key={pr} value={pr}>
                            {pr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col md:col-span-2">
                      <label className="mb-1 text-[11px] font-semibold text-darkgray">
                        Affected Rooms / Zones
                      </label>
                      <input
                        type="text"
                        value={revAffectedRooms}
                        onChange={(e) => setRevAffectedRooms(e.target.value)}
                        placeholder="e.g. Living Room, Kitchen area"
                        className="w-full text-[11px] bg-light-gray border border-bordergray rounded-md px-3 py-2.5 focus:outline-none focus:border-gray-300"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-darkgray mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={revDescription}
                      onChange={(e) => setRevDescription(e.target.value)}
                      className="w-full text-[11px] bg-light-gray border border-bordergray rounded-md p-3 focus:outline-none focus:border-gray-300 resize-none"
                      placeholder="Describe what client wants to modify..."
                    />
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-darkgray">
                        Attachments
                      </label>
                      <ReusableFileUploader
                        allowedTypes={[
                          "PDF",
                          "DOC",
                          "DOCX",
                          "JPG",
                          "PNG",
                          "ZIP",
                        ]}
                        maxSizeMB={50}
                        multiple={true}
                        onUploadSuccess={handleNewRevisionAttachmentSuccess}
                        uploadedBy="Client (Ankit)"
                        buttonText="Add Attachments"
                      />
                    </div>
                    <div className="border-b border-gray-100 mb-3" />

                    {newRevisionAttachments.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-left text-xs text-darkgray">
                          <thead>
                            <tr className="bg-palewhite border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-3">File Name</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Uploaded By</th>
                              <th className="p-3">Date</th>
                              <th className="p-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {newRevisionAttachments.map((f) => (
                              <tr
                                key={f.id}
                                className="hover:bg-palewhite/50 transition-colors"
                              >
                                <td
                                  className="p-3 font-bold truncate max-w-[200px]"
                                  title={f.name}
                                >
                                  {f.name}
                                </td>
                                <td className="p-3 font-semibold text-gray-500 uppercase">
                                  {f.type}
                                </td>
                                <td className="p-3 font-semibold text-gray-500">
                                  {f.uploadedBy}
                                </td>
                                <td className="p-3 text-gray-400 font-semibold">
                                  {f.uploadedDate}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNewRevisionAttachments((prev) =>
                                        prev.filter((att) => att.id !== f.id),
                                      )
                                    }
                                    className="p-1.5 hover:text-red-500 bg-white border border-gray-200 hover:border-red-500 rounded transition-all cursor-pointer animate-all"
                                    title="Delete"
                                  >
                                    <FiTrash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-2 text-center bg-palewhite rounded-xl border border-gray-100">
                        No attachments uploaded yet.
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-select-blue hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <FiPlus size={14} />
                    <span>Submit Revision Request</span>
                  </button>
                </form>

                {/* Revision Comparison Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Revision Comparison View
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div className="border border-gray-100 rounded-xl p-4 bg-palewhite">
                      <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded uppercase font-semibold">
                        Previous Version (V1)
                      </span>
                      <h4 className="text-xs font-bold text-darkgray mt-3">
                        Scandinavian Light Oak Theme
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Living room with open-layout dining area, partition wood
                        slots, standard white washrooms ceiling.
                      </p>
                      <img
                        src="/survey_living_room.png"
                        alt="Previous"
                        className="w-full h-32 object-cover rounded-lg mt-3 border cursor-pointer"
                        onClick={() =>
                          onExpandPhoto(
                            ["/survey_living_room.png"],
                            0,
                            "Previous Version Render",
                          )
                        }
                      />
                    </div>

                    <div className="border border-gray-250 rounded-xl p-4 bg-blue-50/20">
                      <span className="text-[10px] font-bold text-select-blue bg-white border border-select-blue/20 px-2 py-0.5 rounded uppercase font-semibold">
                        Updated Version (V2)
                      </span>
                      <h4 className="text-xs font-bold text-darkgray mt-3">
                        Scandinavian Cozy Minimalist (with Glass partition)
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Living room with partition wall replaced by black steel
                        framed glass panels, updated TV panel console.
                      </p>
                      <img
                        src="/survey_living_room_2.png"
                        alt="Updated"
                        className="w-full h-32 object-cover rounded-lg mt-3 border cursor-pointer"
                        onClick={() =>
                          onExpandPhoto(
                            ["/survey_living_room_2.png"],
                            0,
                            "Updated Version Render",
                          )
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-darkgray mb-1">
                      Change Summary
                    </label>
                    <textarea
                      rows={2}
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      className="w-full text-[11px] bg-light-gray border border-bordergray rounded-md p-3 focus:outline-none focus:border-gray-300 resize-none"
                      placeholder="Briefly state what was altered..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 2D / 3D DRAWINGS */}
            {activeTab === "drawings" && (
              <div className="space-y-6">
                {/* Drawing Management Table */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray">
                        2D / 3D Drawings
                      </h3>
                      <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                        Manage and review versions of all project design
                        drawings.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-select-blue hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <FiPlus size={14} />
                      <span>Upload Drawing</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left text-xs text-darkgray">
                      <thead>
                        <tr className="bg-palewhite border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Drawing Name</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Version</th>
                          <th className="p-3">Reviewer & Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-center">Visible to Client</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {drawings.map((draw) => {
                          const statusColors = {
                            Draft: "bg-gray-100 border-gray-200 text-gray-600",
                            "Under Review":
                              "bg-amber-50 border-amber-100 text-amber-700",
                            Approved:
                              "bg-emerald-50 border-emerald-100 text-emerald-700",
                            Rejected:
                              "bg-rose-50 border-rose-100 text-rose-700",
                            "Revision Required":
                              "bg-orange-50 border-orange-100 text-orange-700",
                          };
                          const statusStyle =
                            statusColors[draw.status] ||
                            "bg-gray-100 text-gray-600 border-gray-100";

                          return (
                            <tr
                              key={draw.id}
                              className="hover:bg-palewhite transition-colors"
                            >
                              <td className="p-3 font-bold">{draw.name}</td>
                              <td className="p-3 font-semibold text-gray-500">
                                {draw.category === "2D Drawings"
                                  ? "2D Drawing"
                                  : "3D Drawing"}
                              </td>
                              <td className="p-3 font-bold">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-700">
                                  {draw.version}
                                </span>
                              </td>
                              <td className="p-3 font-semibold text-gray-500">
                                {draw.reviewer ? (
                                  <div>
                                    <span className="block font-bold text-slate-800">
                                      {draw.reviewer}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      {draw.reviewDate}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${statusStyle}`}
                                >
                                  {draw.status}
                                </span>
                              </td>
                              <td className="p-3 text-gray-400 font-semibold">
                                {draw.uploadDate}
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={draw.visibleToClient !== false}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setDrawings((prev) =>
                                      prev.map((d) =>
                                        d.id === draw.id
                                          ? { ...d, visibleToClient: val }
                                          : d,
                                      ),
                                    );
                                  }}
                                  className="w-4 h-4 rounded text-select-blue focus:ring-select-blue cursor-pointer"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const ext = draw.fileUrl
                                        .split(".")
                                        .pop()
                                        .toLowerCase();
                                      const fileUrl =
                                        localUrls[draw.id] || draw.fileUrl;
                                      if (
                                        ["png", "jpg", "jpeg", "webp"].includes(
                                          ext,
                                        )
                                      ) {
                                        onExpandPhoto([fileUrl], 0, draw.name);
                                      } else {
                                        window.open(fileUrl, "_blank");
                                      }
                                    }}
                                    className="p-1.5 hover:text-select-blue bg-white border border-gray-200 hover:border-select-blue rounded transition-all cursor-pointer"
                                    title="Preview"
                                  >
                                    <FiEye size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const a = document.createElement("a");
                                      a.href =
                                        localUrls[draw.id] || draw.fileUrl;
                                      a.download = draw.name;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    }}
                                    className="p-1.5 hover:text-emerald-600 bg-white border border-gray-200 hover:border-emerald-600 rounded transition-all cursor-pointer"
                                    title="Download"
                                  >
                                    <FiDownload size={12} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleReplaceFileClick("drawing", draw.id)
                                    }
                                    className="p-1.5 hover:text-amber-600 bg-white border border-gray-200 hover:border-amber-600 rounded transition-all cursor-pointer"
                                    title="Replace / Resubmit"
                                  >
                                    <FiRefreshCw size={12} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setSelectedDrawingForReview(draw)
                                    }
                                    className="p-1.5 hover:text-blue-600 bg-white border border-gray-200 hover:border-blue-600 rounded transition-all cursor-pointer"
                                    title="Review drawing"
                                  >
                                    <FiUserCheck size={12} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setSelectedDrawingForHistory(draw)
                                    }
                                    className="p-1.5 hover:text-blue-500 bg-white border border-gray-200 hover:border-blue-500 rounded transition-all cursor-pointer flex items-center justify-center"
                                    title="Version History"
                                  >
                                    <FiClock size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setModalConfirm({
                                        message: `Are you sure you want to delete drawing "${draw.name}"?`,
                                        onConfirm: () => {
                                          setDrawings((prev) =>
                                            prev.filter(
                                              (d) => d.id !== draw.id,
                                            ),
                                          );
                                          deleteFile(draw.id);
                                          addActivity(
                                            `Deleted drawing: ${draw.name}`,
                                            site.supervisor || "Alex Sterling",
                                          );
                                        },
                                      });
                                    }}
                                    className="p-1.5 hover:text-red-500 bg-white border border-gray-200 hover:border-red-500 rounded transition-all cursor-pointer"
                                    title="Archive/Delete"
                                  >
                                    <FiTrash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const totalDrawingsCount = drawings.length;
                    const approvedDrawingsCount = drawings.filter(
                      (d) => d.status === "Approved",
                    ).length;
                    const pendingDrawingsCount = drawings.filter(
                      (d) =>
                        d.status === "Under Review" ||
                        d.status === "Draft" ||
                        d.status === "Revision Required",
                    ).length;

                    let latestUploadInfo = "No uploads yet";
                    if (drawings.length > 0) {
                      const sorted = [...drawings].sort((a, b) => {
                        const parseDateStr = (str) => {
                          if (!str) return 0;
                          const pts = str.split(/[./-]/);
                          if (pts.length === 3) {
                            return new Date(
                              pts[2],
                              pts[1] - 1,
                              pts[0],
                            ).getTime();
                          }
                          return new Date(str).getTime();
                        };
                        return (
                          parseDateStr(b.uploadDate) -
                          parseDateStr(a.uploadDate)
                        );
                      });
                      if (sorted[0]) {
                        latestUploadInfo = `${sorted[0].name} (${sorted[0].uploadDate})`;
                      }
                    }

                    return (
                      <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-left">
                        <span className="font-bold text-darkgray uppercase tracking-wider text-[10px] block mb-3">
                          Drawings Summary
                        </span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-white border border-gray-100 rounded-lg">
                            <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                              Total Drawings
                            </span>
                            <span className="text-base font-bold text-darkgray mt-1 block">
                              {totalDrawingsCount}
                            </span>
                          </div>
                          <div className="p-3 bg-white border border-gray-100 rounded-lg">
                            <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                              Approved
                            </span>
                            <span className="text-base font-bold text-emerald-600 mt-1 block">
                              {approvedDrawingsCount}
                            </span>
                          </div>
                          <div className="p-3 bg-white border border-gray-100 rounded-lg">
                            <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                              Pending Approval
                            </span>
                            <span className="text-base font-bold text-amber-600 mt-1 block">
                              {pendingDrawingsCount}
                            </span>
                          </div>
                          <div className="p-3 bg-white border border-gray-100 rounded-lg min-w-0">
                            <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                              Latest Upload
                            </span>
                            <span
                              className="text-xs font-bold text-slate-800 mt-1 block truncate"
                              title={latestUploadInfo}
                            >
                              {latestUploadInfo}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB 4: CLIENT APPROVAL */}
            {activeTab === "approval" && (
              <div className="space-y-6">
                {/* Approval Status Flow Visual Indicator */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-6">
                    Client Approval Status Flow
                  </h3>
                  <div className="flex items-center justify-between px-4 py-2 bg-palewhite rounded-2xl border border-gray-100 overflow-x-auto scroll-hidden-bar">
                    {[
                      {
                        key: "Pending",
                        label: "Pending Submission",
                        desc: "Package being prepared",
                      },
                      {
                        key: "Sent",
                        label: "Sent to Client",
                        desc: "Sent, awaiting view",
                      },
                      {
                        key: "Viewed",
                        label: "Viewed",
                        desc: "Opened by client",
                      },
                      {
                        key: "Approved",
                        label: "Approved",
                        desc: "Proposal approved",
                      },
                    ].map((step, sIdx) => {
                      const list = ["Pending", "Sent", "Viewed", "Approved"];
                      const currentIdx = list.indexOf(approvalStatus);
                      const stepIdx = list.indexOf(step.key);

                      const isPassed = stepIdx < currentIdx;
                      const isCurrent = step.key === approvalStatus;

                      return (
                        <div
                          key={step.key}
                          className="flex items-center flex-1 last:flex-none"
                        >
                          <div className="flex flex-col items-center gap-1.5 shrink-0 text-center px-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all ${
                                isPassed
                                  ? "bg-emerald-500 text-white border-emerald-600"
                                  : isCurrent
                                    ? "bg-select-blue text-white border-select-blue shadow-md ring-4 ring-blue-50"
                                    : "bg-white text-gray-400 border-gray-200"
                              }`}
                            >
                              {isPassed ? "✓" : sIdx + 1}
                            </div>
                            <span
                              className={`text-[10px] font-bold ${isCurrent ? "text-select-blue" : "text-gray-500"}`}
                            >
                              {step.label}
                            </span>
                            <span className="text-[8px] text-gray-400 hidden md:block">
                              {step.desc}
                            </span>
                          </div>
                          {sIdx < 3 && (
                            <div
                              className="flex-1 h-[2px] bg-gray-200 mx-2 min-w-[20px]"
                              style={{
                                backgroundColor:
                                  stepIdx < currentIdx ? "#10b981" : "#e5e7eb",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Approval Summary Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Approval Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Design Stage Status
                      </span>
                      <p className="text-sm font-bold text-gray-800 mt-1">
                        {designStatus}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Submitted Date
                      </span>
                      <p className="text-sm font-bold text-gray-800 mt-1">
                        {approvalSubmittedDate || "Not Submitted"}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Reminders Sent
                      </span>
                      <p className="text-sm font-bold text-gray-800 mt-1">
                        {remindersSentCount}{" "}
                        {lastReminderSentDate
                          ? `(Last: ${lastReminderSentDate})`
                          : ""}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Approval Status
                      </span>
                      <div className="mt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            approvalStatus === "Approved"
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                              : approvalStatus === "Sent"
                                ? "bg-blue-50 border-blue-100 text-blue-700"
                                : approvalStatus === "Viewed"
                                  ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                                  : "bg-gray-100 border-gray-200 text-gray-500"
                          }`}
                        >
                          {approvalStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-darkgray uppercase tracking-wider mb-2">
                      Approval Package Notes (Optional submission details)
                    </label>
                    <textarea
                      rows={2}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="e.g. Attached are the complete drawings package including customized bedroom options and material details."
                      className="w-full text-[11px] bg-light-gray border border-bordergray rounded-xl p-3 focus:outline-none focus:border-gray-300 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-4 p-3 bg-palewhite rounded-xl border border-gray-100">
                    <input
                      type="checkbox"
                      id="digital-ack-check"
                      checked={digitalAcknowledgementVerified}
                      onChange={(e) =>
                        setDigitalAcknowledgementVerified(e.target.checked)
                      }
                      className="w-4 h-4 text-select-blue rounded border-gray-300 focus:ring-select-blue cursor-pointer"
                    />
                    <label
                      htmlFor="digital-ack-check"
                      className="text-xs font-bold text-darkgray cursor-pointer"
                    >
                      Digital Acknowledgement Verified (Client has acknowledged
                      and signed terms)
                    </label>
                  </div>
                </div>

                {/* Submission Package Logs History Table */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Submission History Package Log
                  </h3>
                  {approvalHistory.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-left text-xs text-darkgray">
                        <thead>
                          <tr className="bg-palewhite border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-3">Submission Date</th>
                            <th className="p-3">Submitted By</th>
                            <th className="p-3">Notes</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {approvalHistory.map((sub, sIdx) => (
                            <tr
                              key={sub.id || sIdx}
                              className="hover:bg-palewhite/30 transition-colors"
                            >
                              <td className="p-3 font-semibold text-gray-500">
                                {sub.date}
                              </td>
                              <td className="p-3 font-bold text-slate-800">
                                {sub.submittedBy}
                              </td>
                              <td
                                className="p-3 text-gray-500 font-medium truncate max-w-[250px]"
                                title={sub.notes}
                              >
                                {sub.notes}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                    sub.status === "Approved"
                                      ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                      : sub.status === "Sent"
                                        ? "bg-blue-50 border-blue-100 text-blue-700"
                                        : sub.status === "Viewed"
                                          ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                                          : sub.status === "Changes Requested"
                                            ? "bg-amber-50 border-amber-100 text-amber-700"
                                            : "bg-gray-150 text-gray-500"
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-4 bg-palewhite rounded-xl border border-gray-100">
                      No submission history log records found.
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left flex flex-col h-[500px]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4 shrink-0">
                    Client Feedback Thread
                  </h3>
                  <div className="space-y-4 flex-1 overflow-y-auto mb-4 p-2 scroll-hidden-bar">
                    {discussionHistory.map((msg, idx) => {
                      const isClient = msg.author.toLowerCase() === "client";
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[80%] ${isClient ? "mr-auto items-start" : "ml-auto items-end"}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-gray-400">
                              {msg.author}
                            </span>
                            <span className="text-[9px] text-gray-300">•</span>
                            <span className="text-[9px] text-gray-300">
                              {msg.timestamp}
                            </span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed ${
                              isClient
                                ? "bg-gray-100 text-gray-800 rounded-tl-none"
                                : "bg-blue-50 text-select-blue border border-blue-100 rounded-tr-none"
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={clientFeedbackBottomRef} />
                  </div>

                  <form
                    onSubmit={handleAddClientFeedback}
                    className="flex gap-2 items-center shrink-0 border-t border-gray-100 pt-3 bg-white sticky bottom-0"
                  >
                    <select
                      value={feedbackAuthor}
                      onChange={(e) => setFeedbackAuthor(e.target.value)}
                      className="bg-light-gray border border-bordergray text-xs text-darkgray rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
                    >
                      <option value="Designer">Designer</option>
                      <option value="Client">Client</option>
                    </select>
                    <input
                      type="text"
                      value={newFeedback}
                      onChange={(e) => setNewFeedback(e.target.value)}
                      placeholder="Type feedback or reply..."
                      className="flex-1 bg-light-gray border border-bordergray text-xs text-darkgray rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-300"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-select-blue text-white rounded-xl hover:bg-blue-950 transition-colors cursor-pointer text-xs font-bold shrink-0"
                    >
                      Send
                    </button>
                  </form>
                </div>

                {/* Approval Actions Card */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-darkgray border-b border-gray-100 pb-3 mb-4">
                    Approval Actions
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSendForApproval}
                      className="px-5 py-2.5 bg-select-blue hover:bg-blue-950 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all"
                    >
                      Send For Approval
                    </button>
                    <button
                      onClick={handleClientViewed}
                      disabled={approvalStatus === "Pending"}
                      className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-650 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Simulate Client Viewed
                    </button>
                    <button
                      onClick={handleApproveDesign}
                      disabled={approvalStatus === "Pending"}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Approve
                    </button>
                    <button
                      onClick={handleRequestChanges}
                      disabled={approvalStatus === "Pending"}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Request Changes
                    </button>
                    <button
                      onClick={handleRejectDesign}
                      disabled={approvalStatus === "Pending"}
                      className="px-5 py-2.5 bg-red-500 hover:bg-red-650 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Reject Design
                    </button>
                    <button
                      onClick={handleSendReminder}
                      disabled={
                        approvalStatus === "Pending" ||
                        approvalStatus === "Approved"
                      }
                      className="px-5 py-2.5 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200"
                    >
                      Send Reminder
                    </button>
                  </div>

                  {approvalStatus === "Approved" && (
                    <button
                      onClick={handleMoveToExecution}
                      className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex justify-center items-center gap-1.5 border border-emerald-600 animate-pulse"
                    >
                      <FiCheckSquare size={16} />
                      <span>Move to Execution / In Progress</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Internal Comments, Design Activities Feed (1/3 width) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 min-w-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
          <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left flex flex-col h-[500px]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Internal Team Comments
              </h3>
              {unreadCommentCount > 0 && (
                <span className="bg-red-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-full">
                  {unreadCommentCount} Unread
                </span>
              )}
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto mb-3 pr-1 scroll-hidden-bar">
              {internalComments.map((comment) => {
                const isPinned = comment.isPinned;
                const isResolved = comment.isResolved;

                return (
                  <div
                    key={comment.id}
                    className={`p-3 border rounded-xl transition-all ${
                      isPinned
                        ? "bg-amber-50/40 border-amber-200 shadow-sm"
                        : "bg-palewhite border-gray-100"
                    } ${isResolved ? "opacity-60" : ""}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-800">
                          {comment.author}
                        </span>
                        {comment.statusNote && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase border ${
                              comment.statusNote === "Important"
                                ? "bg-red-50 text-red-700 border-red-100"
                                : comment.statusNote === "Feedback"
                                  ? "bg-blue-50 text-select-blue border-blue-100"
                                  : comment.statusNote === "Resolved"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            {comment.statusNote}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-gray-450">
                        {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium leading-relaxed mb-2">
                      {renderCommentText(comment.text)}
                    </p>

                    {/* Replies array */}
                    {comment.replies &&
                      comment.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="ml-4 mt-2 p-2 bg-white border border-gray-100 rounded-lg text-[10px] text-left"
                        >
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold text-slate-700">
                              {rep.author}
                            </span>
                            <span className="text-gray-400 text-[8px]">
                              {rep.timestamp}
                            </span>
                          </div>
                          <p className="text-gray-600 font-medium">
                            {renderCommentText(rep.text)}
                          </p>
                        </div>
                      ))}

                    {/* Inline reply form */}
                    {activeReplyCommentId === comment.id && (
                      <div className="mt-2 ml-4 flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type reply..."
                          className="flex-1 bg-white border border-gray-200 text-[10px] text-darkgray rounded px-2 py-1 focus:outline-none"
                        />
                        <button
                          onClick={() => handleAddReply(comment.id)}
                          className="px-2 py-1 bg-select-blue text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end items-center gap-3 border-t border-gray-200/50 pt-1.5 mt-2 text-[9px] font-bold text-gray-450 uppercase">
                      <button
                        onClick={() => {
                          setActiveReplyCommentId(
                            comment.id === activeReplyCommentId
                              ? null
                              : comment.id,
                          );
                          setReplyText("");
                        }}
                        className="hover:text-select-blue transition-colors"
                      >
                        {activeReplyCommentId === comment.id
                          ? "Cancel"
                          : "Reply"}
                      </button>
                      <button
                        onClick={() => handleTogglePinComment(comment.id)}
                        className="hover:text-amber-600 transition-colors"
                      >
                        {isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => handleToggleResolveComment(comment.id)}
                        className="hover:text-emerald-700 transition-colors"
                      >
                        {isResolved ? "Unresolve" : "Resolve"}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={internalCommentsBottomRef} />
            </div>

            <form
              onSubmit={handleAddComment}
              className="flex flex-col gap-2 shrink-0 border-t border-gray-100 pt-3 bg-white sticky bottom-0"
            >
              <div className="flex gap-2">
                <select
                  value={commentStatusNote}
                  onChange={(e) => setCommentStatusNote(e.target.value)}
                  className="bg-light-gray border border-bordergray text-[10px] text-darkgray rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="Important">Important</option>
                  <option value="Feedback">Feedback</option>
                </select>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Post internally (use @Rahul, @Priya to tag)..."
                  className="flex-1 bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-300"
                />
                <button
                  type="submit"
                  className="p-2 bg-select-blue text-white rounded-lg hover:bg-blue-950 transition-colors cursor-pointer"
                >
                  <FiSend size={12} />
                </button>
              </div>
            </form>
          </div>

          {/* Design Activity Log Timeline */}
          <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2 mb-3">
              Design Activity Timeline
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto scroll-hidden-bar">
              {activities.map((act, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 items-start text-[10px] leading-snug"
                >
                  <FiClock className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-darkgray block">
                      {act.text}
                      {act.user && (
                        <span className="text-[9px] text-gray-400 font-medium ml-1">
                          · by {act.user}
                        </span>
                      )}
                    </span>
                    <span className="text-gray-400 text-[8px]">
                      {act.timestamp || act.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DRAWING UPLOAD DIALOG/MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[440px] p-6 relative animate-all text-left">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setModalDrawingFile(null);
                setDrawName("");
                setShowAddNewDrawNamePopover(false);
                setNewCustomDrawName("");
                setCustomDrawNameError("");
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>

            <h3 className="text-base font-bold text-darkgray mb-4">
              Upload Design Drawing
            </h3>

            <form onSubmit={handleUploadDrawing} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-darkgray">
                    Drawing Name
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddNewDrawNamePopover(true);
                      setNewCustomDrawName("");
                      setCustomDrawNameError("");
                    }}
                    className="text-[10px] font-bold text-select-blue hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <FiPlus size={10} />
                    <span>Add New</span>
                  </button>
                </div>

                <div className="relative">
                  <SearchableSelect
                    value={drawName}
                    onChange={(val) => setDrawName(val)}
                    options={drawingNameOptions}
                    placeholder="Select Drawing Type..."
                    className="w-full text-xs bg-light-gray border border-bordergray rounded-lg px-3 py-2.5 focus:outline-none focus:border-gray-300 cursor-pointer font-semibold"
                  />

                  {/* Inline Popover to Add New Drawing Name */}
                  {showAddNewDrawNamePopover && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-left">
                      <div className="text-[10px] font-bold text-darkgray uppercase tracking-wider mb-2">
                        Add New Drawing Name
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={newCustomDrawName}
                          onChange={(e) => {
                            setNewCustomDrawName(e.target.value);
                            setCustomDrawNameError("");
                          }}
                          placeholder="e.g. Balcony Layout..."
                          className="w-full text-xs bg-light-gray border border-gray-205 rounded-md px-3 py-2 focus:outline-none focus:border-gray-300 text-darkgray font-medium"
                          autoFocus
                        />
                        {customDrawNameError && (
                          <span className="text-[9px] text-red-500 font-bold">
                            {customDrawNameError}
                          </span>
                        )}
                        <div className="flex justify-end gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddNewDrawNamePopover(false);
                              setNewCustomDrawName("");
                              setCustomDrawNameError("");
                            }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCustomDrawingName}
                            className="px-2.5 py-1 bg-select-blue hover:bg-blue-900 text-white text-[10px] font-bold rounded cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-gray-400 mt-1 font-medium">
                  Note: If drawing type matches an existing drawing, it will be
                  uploaded as a new version in history.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-darkgray">
                    Category
                  </label>
                  <select
                    value={drawCategory}
                    onChange={(e) => setDrawCategory(e.target.value)}
                    className="bg-light-gray border border-bordergray text-xs text-darkgray rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
                  >
                    <option value="2D Drawing">2D Drawing</option>
                    <option value="3D Drawing">3D Drawing</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-darkgray">
                    Uploaded By
                  </label>
                  <select
                    value={drawUploadedBy}
                    onChange={(e) => setDrawUploadedBy(e.target.value)}
                    className="bg-light-gray border border-bordergray text-xs text-darkgray rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
                  >
                    {SUPERVISORS_LIST.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-darkgray">
                    Version
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      drawName.trim()
                        ? (() => {
                            const existing = drawings.find(
                              (d) =>
                                d.name.toLowerCase().trim() ===
                                drawName.toLowerCase().trim(),
                            );
                            return existing
                              ? incrementVersion(existing.version)
                              : "V1";
                          })()
                        : "V1"
                    }
                    className="bg-gray-100 border border-bordergray text-xs text-gray-400 rounded-lg px-3 py-2 focus:outline-none cursor-not-allowed font-bold"
                    placeholder="Auto-generated"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-darkgray">
                    Status
                  </label>
                  <select
                    value={drawStatus}
                    onChange={(e) => setDrawStatus(e.target.value)}
                    className="bg-light-gray border border-bordergray text-xs text-darkgray rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-darkgray">
                    Upload Drawing File
                  </label>
                  <ReusableFileUploader
                    allowedTypes={[
                      "DWG",
                      "DXF",
                      "SKP",
                      "PDF",
                      "JPG",
                      "PNG",
                      "JPEG",
                      "MP4",
                    ]}
                    maxSizeMB={50}
                    onUploadSuccess={(fileObj) => setModalDrawingFile(fileObj)}
                    uploadedBy={drawUploadedBy}
                    buttonText="Choose File"
                  />
                </div>
                <div className="border-b border-gray-100 mb-2" />
                {modalDrawingFile ? (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-2.5 text-[11px] font-bold flex justify-between items-center">
                    <span className="truncate max-w-[85%]">
                      {modalDrawingFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalDrawingFile(null)}
                      className="text-red-500 hover:text-red-700 cursor-pointer p-0.5"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-2 bg-palewhite rounded-xl border border-gray-100">
                    No drawing file selected.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 pb-3">
                <input
                  type="checkbox"
                  id="drawVisibleToClient"
                  checked={drawVisibleToClient}
                  onChange={(e) => setDrawVisibleToClient(e.target.checked)}
                  className="w-4 h-4 rounded text-select-blue focus:ring-select-blue cursor-pointer"
                />
                <label
                  htmlFor="drawVisibleToClient"
                  className="text-xs font-bold text-darkgray cursor-pointer select-none"
                >
                  Visible to Client
                </label>
              </div>

              <button
                type="submit"
                disabled={!modalDrawingFile}
                className="w-full py-2.5 bg-select-blue hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex justify-center items-center gap-1.5 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <FiUploadCloud size={14} />
                <span>Upload Drawing</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DRAWING VERSION HISTORY MODAL */}
      {selectedDrawingForHistory && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[600px] p-6 relative text-left">
            <button
              onClick={() => setSelectedDrawingForHistory(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>

            <h3 className="text-base font-bold text-darkgray mb-1">
              Version History
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-4">
              Drawing: {selectedDrawingForHistory.name}
            </p>

            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs text-darkgray">
                <thead>
                  <tr className="bg-palewhite border-b border-gray-100 text-gray-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Version</th>
                    <th className="p-3">File Name</th>
                    <th className="p-3">Change Notes</th>
                    <th className="p-3">Uploaded By</th>
                    <th className="p-3">Upload Date</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(selectedDrawingForHistory.versions || []).map(
                    (v, index) => (
                      <tr
                        key={index}
                        className="hover:bg-palewhite/50 transition-colors"
                      >
                        <td className="p-3 font-bold text-select-blue">
                          {v.version}
                        </td>
                        <td
                          className="p-3 truncate max-w-[150px]"
                          title={v.name}
                        >
                          {v.name}
                        </td>
                        <td
                          className="p-3 font-semibold text-gray-500 italic truncate max-w-[150px]"
                          title={v.changeNotes}
                        >
                          {v.changeNotes || "No change notes."}
                        </td>
                        <td className="p-3 text-gray-500 font-semibold">
                          {v.uploadedBy}
                        </td>
                        <td className="p-3 text-gray-400 font-semibold">
                          {v.uploadDate}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                const ext = v.name
                                  .split(".")
                                  .pop()
                                  .toLowerCase();
                                if (
                                  ["png", "jpg", "jpeg", "webp"].includes(ext)
                                ) {
                                  onExpandPhoto(
                                    [v.url],
                                    0,
                                    `${selectedDrawingForHistory.name} (${v.version})`,
                                  );
                                } else {
                                  window.open(v.url, "_blank");
                                }
                              }}
                              className="p-1 hover:text-select-blue bg-white border border-gray-200 hover:border-select-blue rounded transition-all cursor-pointer"
                              title="Preview"
                            >
                              <FiEye size={11} />
                            </button>
                            <button
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = v.url;
                                a.download = v.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="p-1 hover:text-emerald-600 bg-white border border-gray-200 hover:border-emerald-600 rounded transition-all cursor-pointer"
                              title="Download"
                            >
                              <FiDownload size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REFERENCE FILE VERSION HISTORY MODAL */}
      {selectedReferenceFileForHistory && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[600px] p-6 relative text-left">
            <button
              onClick={() => setSelectedReferenceFileForHistory(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>

            <h3 className="text-base font-bold text-darkgray mb-1">
              Reference File Version History
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-4">
              File: {selectedReferenceFileForHistory.name}
            </p>

            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs text-darkgray">
                <thead>
                  <tr className="bg-palewhite border-b border-gray-100 text-gray-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Version</th>
                    <th className="p-3">File Name</th>
                    <th className="p-3">Change Notes</th>
                    <th className="p-3">Uploaded By</th>
                    <th className="p-3">Upload Date</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(selectedReferenceFileForHistory.versions || []).map(
                    (v, index) => (
                      <tr
                        key={index}
                        className="hover:bg-palewhite/50 transition-colors"
                      >
                        <td className="p-3 font-bold text-select-blue">
                          {v.version}
                        </td>
                        <td
                          className="p-3 truncate max-w-[150px]"
                          title={v.name}
                        >
                          {v.name}
                        </td>
                        <td
                          className="p-3 font-semibold text-gray-500 italic truncate max-w-[150px]"
                          title={v.changeNotes}
                        >
                          {v.changeNotes || "No change notes."}
                        </td>
                        <td className="p-3 text-gray-500 font-semibold">
                          {v.uploadedBy}
                        </td>
                        <td className="p-3 text-gray-400 font-semibold">
                          {v.uploadDate}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                const ext = v.name
                                  .split(".")
                                  .pop()
                                  .toLowerCase();
                                const verKey = `${selectedReferenceFileForHistory.id}-${v.version}`;
                                const fileUrl = localUrls[verKey] || v.url;
                                if (
                                  ["png", "jpg", "jpeg", "webp"].includes(ext)
                                ) {
                                  onExpandPhoto(
                                    [fileUrl],
                                    0,
                                    `${selectedReferenceFileForHistory.name} (${v.version})`,
                                  );
                                } else {
                                  window.open(fileUrl, "_blank");
                                }
                              }}
                              className="p-1 hover:text-select-blue bg-white border border-gray-200 hover:border-select-blue rounded transition-all cursor-pointer"
                              title="Preview"
                            >
                              <FiEye size={11} />
                            </button>
                            <button
                              onClick={() => {
                                const a = document.createElement("a");
                                const verKey = `${selectedReferenceFileForHistory.id}-${v.version}`;
                                a.href = localUrls[verKey] || v.url;
                                a.download = v.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="p-1 hover:text-emerald-600 bg-white border border-gray-200 hover:border-emerald-600 rounded transition-all cursor-pointer"
                              title="Download"
                            >
                              <FiDownload size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DRAWING REVIEW MODAL */}
      {selectedDrawingForReview && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[440px] p-6 relative text-left">
            <button
              onClick={() => setSelectedDrawingForReview(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>
            <h3 className="text-base font-bold text-darkgray mb-1">
              Review drawing proposal
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-4">
              Drawing: {selectedDrawingForReview.name} (
              {selectedDrawingForReview.version})
            </p>

            <ReviewDrawingForm
              supervisors={SUPERVISORS_LIST}
              currentReviewer={
                selectedDrawingForReview.reviewer || "Vijay K. (Supervisor)"
              }
              currentComments={selectedDrawingForReview.reviewComments}
              onSubmit={(reviewer, comments, status) =>
                handleReviewDrawingSubmit(reviewer, comments, status)
              }
            />
          </div>
        </div>
      )}

      {/* REVISION DETAILS MODAL */}
      {selectedRevisionForDetails && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[500px] p-6 relative text-left">
            <button
              onClick={() => setSelectedRevisionForDetails(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>
            <h3 className="text-base font-bold text-darkgray mb-1">
              {selectedRevisionForDetails.revisionNumber || "Revision Details"}
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-4">
              Requested By: {selectedRevisionForDetails.requestedBy} on{" "}
              {selectedRevisionForDetails.date}
              {selectedRevisionForDetails.status === "Completed" && (
                <>
                  <span className="block mt-1">
                    Completed By:{" "}
                    {selectedRevisionForDetails.completedBy ||
                      "Priya S. (Designer)"}{" "}
                    on{" "}
                    {selectedRevisionForDetails.completedDate ||
                      selectedRevisionForDetails.date}
                  </span>
                </>
              )}
            </p>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                    Reason / Category
                  </span>
                  <span className="font-semibold text-darkgray">
                    {selectedRevisionForDetails.category}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                    Affected Rooms
                  </span>
                  <span className="font-semibold text-darkgray">
                    {selectedRevisionForDetails.affectedRooms || "All Rooms"}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block">
                  Description
                </span>
                <p className="text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">
                  {selectedRevisionForDetails.description}
                </p>
              </div>

              <div>
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block mb-1">
                  Resolution Notes
                </span>
                <textarea
                  rows={2}
                  disabled={
                    selectedRevisionForDetails.status === "Awaiting Payment"
                  }
                  value={selectedRevisionForDetails.resolutionNotes || ""}
                  onChange={(e) => {
                    const text = e.target.value;
                    setRevisions((prev) =>
                      prev.map((r) =>
                        r.id === selectedRevisionForDetails.id
                          ? { ...r, resolutionNotes: text }
                          : r,
                      ),
                    );
                    setSelectedRevisionForDetails((prev) => ({
                      ...prev,
                      resolutionNotes: text,
                    }));
                  }}
                  placeholder={
                    selectedRevisionForDetails.status === "Awaiting Payment"
                      ? "Locked: Client payment is awaiting."
                      : "Enter details on how this request was resolved/addressed..."
                  }
                  className="w-full text-xs bg-light-gray border border-bordergray rounded-xl p-2.5 focus:outline-none focus:border-gray-300 resize-none disabled:opacity-50"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Resolved / Updated Files
                  </span>
                  {selectedRevisionForDetails.status === "Awaiting Payment" ? (
                    <span className="text-[10px] text-rose-500 font-bold">
                      Upload Disabled (Awaiting Payment)
                    </span>
                  ) : (
                    <ReusableFileUploader
                      allowedTypes={["PDF", "DOC", "DOCX", "JPG", "PNG", "ZIP"]}
                      maxSizeMB={50}
                      onUploadSuccess={(fileObj) => {
                        const newFile = {
                          ...fileObj,
                          versions: [
                            {
                              version: "V1",
                              name: fileObj.name,
                              url: fileObj.url,
                              uploadedBy: "Priya S. (Designer)",
                              uploadDate: new Date().toLocaleDateString(
                                "en-IN",
                              ),
                              fileSize: formatBytes(fileObj.size),
                              size: fileObj.size,
                              changeNotes: "Resolved revision updated drawing.",
                            },
                          ],
                        };
                        setRevisions((prev) =>
                          prev.map((r) => {
                            if (r.id === selectedRevisionForDetails.id) {
                              const updatedFiles = [
                                ...(r.attachedFiles || []),
                                newFile,
                              ];
                              return { ...r, attachedFiles: updatedFiles };
                            }
                            return r;
                          }),
                        );
                        setSelectedRevisionForDetails((prev) => ({
                          ...prev,
                          attachedFiles: [
                            ...(prev.attachedFiles || []),
                            newFile,
                          ],
                        }));
                        addActivity(
                          "Uploaded resolved drawing to revision request",
                          "Priya S. (Designer)",
                        );
                        addNotification(
                          "Resolved file uploaded to revision",
                          "success",
                        );
                      }}
                      uploadedBy="Priya S. (Designer)"
                      buttonText="Upload File"
                    />
                  )}
                </div>
                {selectedRevisionForDetails.attachedFiles &&
                selectedRevisionForDetails.attachedFiles.length > 0 ? (
                  <div className="border border-gray-100 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
                    {selectedRevisionForDetails.attachedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex justify-between items-center p-2.5 hover:bg-palewhite/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className="font-bold text-darkgray truncate block max-w-[200px]"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium uppercase">
                            {file.type} • {file.version}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const ext = file.type.toLowerCase();
                              const fileUrl = localUrls[file.id] || file.url;
                              if (
                                ["png", "jpg", "jpeg", "webp"].includes(ext)
                              ) {
                                onExpandPhoto([fileUrl], 0, file.name);
                              } else {
                                window.open(fileUrl, "_blank");
                              }
                            }}
                            className="p-1 hover:text-select-blue bg-white border border-gray-150 rounded cursor-pointer animate-all"
                            title="View"
                          >
                            <FiEye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = localUrls[file.id] || file.url;
                              a.download = file.name;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            className="p-1 hover:text-emerald-600 bg-white border border-gray-150 rounded cursor-pointer animate-all"
                            title="Download"
                          >
                            <FiDownload size={12} />
                          </button>
                          <button
                            onClick={() =>
                              handleReplaceFileClick(
                                "revision-attachment",
                                file.id,
                                selectedRevisionForDetails.id,
                              )
                            }
                            className="p-1 hover:text-amber-600 bg-white border border-gray-150 rounded cursor-pointer animate-all"
                            title="Replace"
                          >
                            <FiRefreshCw size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setModalConfirm({
                                message: `Are you sure you want to delete attachment "${file.name}"?`,
                                onConfirm: () => {
                                  handleDeleteRevisionAttachment(
                                    selectedRevisionForDetails.id,
                                    file.id,
                                  );
                                  setSelectedRevisionForDetails((prev) => ({
                                    ...prev,
                                    attachedFiles: prev.attachedFiles.filter(
                                      (f) => f.id !== file.id,
                                    ),
                                  }));
                                },
                              });
                            }}
                            className="p-1 hover:text-red-500 bg-white border border-gray-150 rounded cursor-pointer animate-all"
                            title="Delete"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-center py-2 bg-palewhite rounded-xl border border-gray-100">
                    No files uploaded yet. (Updated drawing file required to
                    mark completed)
                  </p>
                )}
              </div>

              <div>
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider block mb-2">
                  Action Status
                </span>
                {selectedRevisionForDetails.status === "Awaiting Payment" ? (
                  <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 font-bold text-xs">
                    <span className="animate-pulse">⚠️</span>
                    <span>Blocked: Payment Awaiting</span>
                    <span className="text-[10px] font-semibold text-rose-500">
                      (Client must clear the additional revision invoice in the
                      portal)
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {selectedRevisionForDetails.status !== "In Progress" &&
                      selectedRevisionForDetails.status !== "Completed" && (
                        <button
                          onClick={() => {
                            handleUpdateRevisionStatus(
                              selectedRevisionForDetails.id,
                              "In Progress",
                            );
                            setSelectedRevisionForDetails((prev) => ({
                              ...prev,
                              status: "In Progress",
                            }));
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                          Mark In Progress
                        </button>
                      )}
                    {selectedRevisionForDetails.status !== "Completed" && (
                      <button
                        onClick={() => {
                          if (
                            !selectedRevisionForDetails.resolutionNotes?.trim()
                          ) {
                            setModalAlert({
                              message:
                                "Please enter resolution notes detailing the changes made before completing.",
                            });
                            return;
                          }
                          if (
                            !selectedRevisionForDetails.attachedFiles ||
                            selectedRevisionForDetails.attachedFiles.length ===
                              0
                          ) {
                            setModalAlert({
                              message:
                                "Please upload at least one updated/resolved drawing file to complete.",
                            });
                            return;
                          }
                          handleUpdateRevisionStatus(
                            selectedRevisionForDetails.id,
                            "Completed",
                          );
                          setSelectedRevisionForDetails((prev) => ({
                            ...prev,
                            status: "Completed",
                            completedDate: new Date().toLocaleDateString(
                              "en-IN",
                            ),
                            completedBy: "Priya S. (Designer)",
                          }));
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg cursor-pointer transition-colors"
                      >
                        Mark Completed
                      </button>
                    )}
                    {selectedRevisionForDetails.status === "Completed" && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        ✓ Resolved & Completed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLACEMENT UPLOADING PROGRESS OVERLAY */}
      {replacementUploading && (
        <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100 flex flex-col items-center">
            <FiRefreshCw className="text-select-blue w-12 h-12 mb-3 animate-spin" />
            <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider mb-2">
              Replacing File
            </h4>
            <p className="text-xs text-gray-500 font-semibold leading-relaxed mb-4">
              Uploading new version...
            </p>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-select-blue rounded-full transition-all duration-75"
                style={{ width: `${replacementProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-select-blue mt-2">
              {replacementProgress}%
            </span>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {modalAlert && (
        <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100 flex flex-col items-center">
            <FiAlertTriangle className="text-amber-500 w-12 h-12 mb-3" />
            <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider mb-2">
              Notice
            </h4>
            <p className="text-xs text-gray-500 font-semibold leading-relaxed mb-6">
              {modalAlert.message}
            </p>
            <button
              onClick={() => setModalAlert(null)}
              className="w-full py-2.5 bg-select-blue hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM MODAL */}
      {modalConfirm && (
        <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100 flex flex-col items-center">
            <FiAlertTriangle className="text-red-500 w-12 h-12 mb-3" />
            <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider mb-2">
              Confirm Action
            </h4>
            <p className="text-xs text-gray-500 font-semibold leading-relaxed mb-6">
              {modalConfirm.message}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setModalConfirm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-darkgray rounded-xl text-xs font-bold transition-all cursor-pointer border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  modalConfirm.onConfirm();
                  setModalConfirm(null);
                }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-red-650"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PROMPT MODAL */}
      {modalPrompt && (
        <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
          <PromptModal
            message={modalPrompt.message}
            onCancel={() => {
              if (modalPrompt.onCancel) modalPrompt.onCancel();
              setModalPrompt(null);
            }}
            onConfirm={(val) => {
              modalPrompt.onConfirm(val);
              setModalPrompt(null);
            }}
          />
        </div>
      )}

      {/* REFERENCE FILE UPLOAD MODAL */}
      {showRefUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-[650px] p-6 relative text-left border border-gray-100 max-h-[90vh] flex flex-col overflow-hidden">
            <button
              onClick={() => {
                setShowRefUploadModal(false);
                setRefUploadCategory("");
                setRefUploadFiles([]);
              }}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>

            <h3 className="text-base font-bold text-darkgray mb-1">
              Upload Reference Files
            </h3>
            <p className="text-xs text-gray-400 font-semibold mb-6">
              Add files to help in the design process.
            </p>

            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              {/* Category Field */}
              <div className="flex flex-col">
                <label className="mb-2 text-xs font-bold text-darkgray uppercase tracking-wider flex items-center gap-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={refUploadCategory}
                  onChange={(val) => setRefUploadCategory(val)}
                  options={getRoomCategories()}
                  className="w-full text-xs bg-light-gray border border-bordergray rounded-lg px-3 py-2.5 focus:outline-none focus:border-gray-300 cursor-pointer font-semibold"
                  placeholder="Select a room / space category..."
                />
              </div>

              {/* Drag and Drop Zone */}
              <div className="flex flex-col">
                <label className="mb-2 text-xs font-bold text-darkgray uppercase tracking-wider">
                  Upload Files <span className="text-red-500">*</span>
                </label>
                
                <div
                  onDragEnter={handleRefDragEnter}
                  onDragOver={handleRefDragOver}
                  onDragLeave={handleRefDragLeave}
                  onDrop={handleRefDropFiles}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-select-blue bg-blue-50/20 shadow-inner scale-[0.99]"
                      : "border-gray-200 bg-slate-50/50 hover:border-select-blue hover:bg-blue-50/10"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileSelectChange}
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-select-blue mb-1">
                      <FiUploadCloud size={24} />
                    </div>
                    <p className="text-xs font-bold text-darkgray">
                      Drag & drop reference files here, or <span className="text-select-blue underline">browse</span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      Supports JPG, PNG, WEBP, PDF, DOC, DOCX up to 50MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Uploaded files preview list */}
              {refUploadFiles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-darkgray uppercase tracking-wider">
                    Uploaded Files ({refUploadFiles.length})
                  </h4>
                  <div className="border border-gray-100 rounded-xl divide-y divide-gray-150 overflow-hidden">
                    {refUploadFiles.map((f) => {
                      const isImg = ["JPG", "JPEG", "PNG", "WEBP"].includes(f.type);
                      return (
                        <div key={f.id} className="p-3 bg-palewhite/40 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImg ? (
                              <img
                                src={f.url}
                                alt="Preview"
                                className="w-10 h-10 object-cover rounded-lg border border-gray-100 shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 text-select-blue flex items-center justify-center shrink-0 text-xs font-bold">
                                {f.type}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-darkgray truncate max-w-[250px]" title={f.name}>
                                {f.name}
                              </p>
                              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                                {formatBytes(f.size)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {f.status === "uploading" ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-semibold">
                                  {f.progress}%
                                </span>
                                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-select-blue rounded-full transition-all duration-300"
                                    style={{ width: `${f.progress}%` }}
                                  />
                                </div>
                              </div>
                            ) : f.status === "success" ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded uppercase tracking-wider">
                                Ready
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-150 px-2 py-0.5 rounded uppercase tracking-wider">
                                Error
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveQueuedFile(f.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 bg-white border border-gray-150 rounded-lg hover:border-red-200 transition-all cursor-pointer"
                              title="Remove"
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-150 pt-4 mt-6 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowRefUploadModal(false);
                  setRefUploadCategory("");
                  setRefUploadFiles([]);
                }}
                className="px-4 py-2 border border-border text-xs font-bold text-darkgray hover:bg-bg-soft rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReferenceFiles}
                disabled={isSaveDisabled}
                className="px-5 py-2 bg-select-blue hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Save Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transient toast notifications list */}
      <div className="fixed bottom-4 right-4 z-150 space-y-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 pointer-events-auto animate-bounce bg-white ${
              n.type === "success"
                ? "text-emerald-700 border-emerald-100 bg-emerald-50/90"
                : n.type === "warning"
                  ? "text-amber-700 border-amber-100 bg-amber-50/90"
                  : n.type === "error"
                    ? "text-red-700 border-red-100 bg-red-50/90"
                    : "text-select-blue border-blue-100 bg-blue-50/90"
            }`}
          >
            <span>{n.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Subcomponent for Review Drawing Form
function ReviewDrawingForm({
  supervisors,
  currentReviewer,
  currentComments,
  onSubmit,
}) {
  const [reviewer, setReviewer] = useState(currentReviewer);
  const [comments, setComments] = useState(currentComments || "");
  const [status, setStatus] = useState("Approved");

  return (
    <div className="space-y-4 text-xs">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-darkgray mb-1">
          Reviewer / Supervisor
        </label>
        <select
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          className="w-full text-xs bg-light-gray border border-bordergray rounded-lg px-3 py-2 focus:outline-none cursor-pointer font-semibold"
        >
          {supervisors.map((sup) => (
            <option key={sup} value={sup}>
              {sup}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-darkgray mb-1">
          Review Comments / Feedback
        </label>
        <textarea
          rows={3}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Enter detailed review comments..."
          className="w-full text-xs bg-light-gray border border-bordergray rounded-xl p-2.5 focus:outline-none focus:border-gray-300 resize-none font-medium"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-darkgray mb-1">
          Review Action Status
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              key: "Approved",
              label: "Approve",
              color: "bg-emerald-500 hover:bg-emerald-600 text-white",
            },
            {
              key: "Revision Required",
              label: "Req Revision",
              color: "bg-orange-500 hover:bg-orange-600 text-white",
            },
            {
              key: "Rejected",
              label: "Reject",
              color: "bg-red-500 hover:bg-red-600 text-white",
            },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setStatus(opt.key);
                onSubmit(reviewer, comments, opt.key);
              }}
              className={
                "py-2 rounded-lg font-bold text-center transition-all cursor-pointer " +
                (status === opt.key
                  ? opt.color
                  : "bg-gray-150 hover:bg-gray-200 text-gray-700")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[9px] text-gray-400 italic">
        * Clicking any of the action buttons above will instantly submit this
        review decision.
      </p>
    </div>
  );
}

function PromptModal({ message, onCancel, onConfirm }) {
  const [value, setValue] = useState("");
  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100 flex flex-col text-left">
      <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider mb-3">
        Feedback Required
      </h4>
      <p className="text-xs text-gray-500 font-semibold leading-relaxed mb-3">
        {message}
      </p>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type details here..."
        className="w-full text-xs bg-light-gray border border-bordergray rounded-xl p-3 focus:outline-none focus:border-gray-300 resize-none mb-4"
      />
      <div className="flex gap-3 w-full justify-end">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-darkgray rounded-xl text-xs font-bold transition-all cursor-pointer border border-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(value)}
          disabled={!value.trim()}
          className="px-5 py-2.5 bg-select-blue hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
