import { randomUUID } from "crypto";
import {
  AuditLog,
  DashboardSummary,
  Post,
  PostStatus,
  InboxSummary,
  Project,
  RepoAccess,
  Brief,
  ScheduleProposal,
  ScheduleStatus,
  StorageAdapter,
  Task,
  TaskStatus,
} from "./types";

const nowIso = () => new Date().toISOString();

type MemoryData = {
  projects: Project[];
  briefs: Brief[];
  posts: Post[];
  schedules: ScheduleProposal[];
  tasks: Task[];
  repos: RepoAccess[];
  auditLogs: AuditLog[];
};

const seedData = (): MemoryData => {
  const createdAt = nowIso();
  const posts: Post[] = [
    {
      id: "post-tenra-assembly-li-001",
      projectId: "project-tenra-assembly",
      platform: "LinkedIn",
      title: "tenra Assembly Q1 Launch",
      status: "NEEDS_REVIEW",
      postJson: {
        headline: "tenra launches tenra Assembly",
        body: "Introducing Assembly for pipeline visibility.",
        cta: "Book a demo",
      },
      claims: ["Launch date confirmed", "Internal tooling only"],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "post-tenra-assembly-x-001",
      projectId: "project-tenra-assembly",
      platform: "X",
      title: "tenra Assembly teaser",
      status: "NEEDS_REVIEW",
      postJson: {
        text: "Assembly keeps the post pipeline clear: repo -> brief -> posts -> approvals -> schedule.",
      },
      claims: ["Internal workflow summary"],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "post-tenra-assembly-fb-001",
      projectId: "project-tenra-assembly",
      platform: "Facebook",
      title: "Assembly v1 announcement",
      status: "NEEDS_REVIEW",
      postJson: {
        headline: "Assembly v1",
        body: "An internal ops panel for the social pipeline.",
      },
      claims: ["Internal-only app"],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "post-tenra-li-001",
      projectId: "project-tenra",
      platform: "LinkedIn",
      title: "tenra monthly update",
      status: "NEEDS_REVIEW",
      postJson: {
        headline: "tenra product update",
        body: "Pipeline visibility and approvals tightened.",
      },
      claims: ["Internal approval flow"],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "post-tenra-x-001",
      projectId: "project-tenra",
      platform: "X",
      title: "tenra schedule note",
      status: "NEEDS_REVIEW",
      postJson: {
        text: "tenra posts now follow a clear review and schedule path.",
      },
      claims: ["Schedule path defined"],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "post-tenra-fb-001",
      projectId: "project-tenra",
      platform: "Facebook",
      title: "tenra ops panel",
      status: "NEEDS_REVIEW",
      postJson: {
        headline: "tenra ops",
        body: "Review posts, approve schedules, keep reminders on track.",
      },
      claims: ["Internal review steps"],
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const schedules: ScheduleProposal[] = [
    {
      id: "schedule-001",
      projectId: "project-tenra-assembly",
      status: "NEEDS_REVIEW",
      items: posts.map((post) => ({
        id: `item-${post.id}`,
        postId: post.id,
        channel: post.platform,
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      })),
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const tasks: Task[] = [
    {
      id: "task-001",
      projectId: "project-tenra-assembly",
      title: "Send LinkedIn post to Legal",
      status: "PENDING",
      dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      copyText: "Please review the tenra LinkedIn post for compliance.",
    },
    {
      id: "task-002",
      projectId: "project-tenra-assembly",
      title: "Collect asset approvals",
      status: "PENDING",
      dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      copyText: "Confirm the final hero image is approved for Assembly v1.",
    },
    {
      id: "task-003",
      projectId: "project-tenra",
      title: "Confirm schedule with PM",
      status: "PENDING",
      dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      copyText: "Confirm tenra social schedule for next week.",
    },
    {
      id: "task-004",
      projectId: "project-tenra",
      title: "Post reminder email",
      status: "PENDING",
      dueAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      copyText: "Send a reminder for tenra content owners.",
    },
  ];

  const repos: RepoAccess[] = [
    {
      id: "repo-001",
      repo: "jmars319/Assembly",
      projectTag: "tenra Assembly",
      enabled: true,
      triggerPosts: true,
      triggerSchedules: true,
      triggerTasks: true,
    },
    {
      id: "repo-002",
      repo: "tenra/social-kit",
      projectTag: "tenra",
      enabled: true,
      triggerPosts: true,
      triggerSchedules: false,
      triggerTasks: true,
    },
  ];

  const projects: Project[] = [
    { id: "project-tenra-assembly", name: "tenra Assembly", tag: "tenra Assembly" },
    { id: "project-tenra", name: "tenra", tag: "tenra" },
  ];

  const briefs: Brief[] = [
    {
      id: "brief-001",
      projectId: "project-tenra-assembly",
      sourceRepoId: undefined,
      summary: "Launch Assembly v1 with clear internal positioning and review steps.",
      createdAt,
    },
  ];

  return {
    projects,
    briefs,
    posts,
    schedules,
    tasks,
    repos,
    auditLogs: [],
  };
};

const data = seedData();

const addAuditLog = (entry: Omit<AuditLog, "id" | "createdAt">) => {
  data.auditLogs.unshift({
    id: randomUUID(),
    createdAt: nowIso(),
    ...entry,
  });
};

export const createMemoryStore = (_workspaceId: string): StorageAdapter => {
  void _workspaceId;
  return {
  async getDashboard(): Promise<DashboardSummary> {
    return {
      counts: {
        postsReady: data.posts.filter((post) => post.status === "NEEDS_REVIEW").length,
        schedulesReady: data.schedules.filter((schedule) => schedule.status === "NEEDS_REVIEW").length,
        tasksDue: data.tasks.filter((task) => task.status === "PENDING").length,
      },
      recentAudit: data.auditLogs.slice(0, 10),
    };
  },

  async listInbox(): Promise<InboxSummary> {
    return {
      posts: data.posts.filter((post) => post.status === "NEEDS_REVIEW"),
      schedules: data.schedules.filter((schedule) => schedule.status === "NEEDS_REVIEW"),
    };
  },

  async listProjects() {
    return [...data.projects];
  },

  async listBriefs() {
    return [...data.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getBrief(id: string) {
    return data.briefs.find((brief) => brief.id === id) ?? null;
  },

  async listPosts() {
    return data.posts;
  },

  async getPost(id: string) {
    return data.posts.find((post) => post.id === id) ?? null;
  },

  async updatePostStatus(id: string, status: PostStatus, note?: string) {
    const post = data.posts.find((item) => item.id === id);
    if (!post) return null;
    post.status = status;
    post.updatedAt = nowIso();
    addAuditLog({
      actor: "admin",
      action: `POST_${status}`,
      entityType: "Post",
      entityId: post.id,
      note,
    });
    return post;
  },

  async getSchedule(id: string) {
    return data.schedules.find((schedule) => schedule.id === id) ?? null;
  },

  async listSchedules() {
    return data.schedules;
  },

  async updateScheduleStatus(id: string, status: ScheduleStatus, note?: string) {
    const schedule = data.schedules.find((item) => item.id === id);
    if (!schedule) return null;
    schedule.status = status;
    schedule.updatedAt = nowIso();
    addAuditLog({
      actor: "admin",
      action: `SCHEDULE_${status}`,
      entityType: "ScheduleProposal",
      entityId: schedule.id,
      note,
    });
    return schedule;
  },

  async listTasks() {
    return [...data.tasks].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  },

  async updateTaskStatus(id: string, status: TaskStatus) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return null;
    task.status = status;
    addAuditLog({
      actor: "admin",
      action: `TASK_${status}`,
      entityType: "Task",
      entityId: task.id,
    });
    return task;
  },

  async listRepos() {
    return data.repos;
  },

  async updateRepos(repos: RepoAccess[]) {
    data.repos = repos;
    addAuditLog({
      actor: "admin",
      action: "SETTINGS_REPOS_UPDATED",
      entityType: "RepoAccess",
      entityId: "repo-allowlist",
      metadata: { count: repos.length },
    });
    return data.repos;
  },

  async listAuditLogs(limit: number) {
    return data.auditLogs.slice(0, limit);
  },
  };
};
