import type { Clerk } from "@clerk/clerk-js";
import {
  type LocalProfile,
  formatMemberDate,
  initials,
  localAuth,
  profileScope,
} from "../auth/session";
import { h } from "../lib/dom";
import { type IconName, icon } from "./icons";
import { REPO_URL } from "./links";

export interface AuthUI {
  open(): void;
  render(): void;
}

interface AuthOptions {
  root: HTMLElement;
  toast(message: string, tone?: "info" | "error"): void;
  onSignIn?: () => void;
}

const CLERK_KEY =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() ??
  "";

const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#1f3be8",
    colorBackground: "#f7f4ec",
    colorText: "#10110e",
    colorTextSecondary: "#5d5b52",
    colorInputBackground: "#ffffff",
    colorInputText: "#10110e",
    colorNeutral: "#10110e",
    borderRadius: "12px",
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif",
    fontSize: "15px",
  },
  elements: {
    card: "box-shadow: 0 30px 80px rgba(16,17,14,.24); border: 1px solid rgba(16,17,14,.12);",
    headerTitle: "letter-spacing: -0.035em;",
    headerSubtitle: "color: #5d5b52;",
    socialButtonsBlockButton: "border-color: rgba(16,17,14,.16);",
    formButtonPrimary:
      "background: #1f3be8; text-transform: none; font-weight: 600;",
    footerActionLink: "color: #1f3be8;",
  },
};

function iconEl(name: IconName): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "icon";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = icon(name);
  return el;
}

function avatarEl(profile: LocalProfile, extraClass = ""): HTMLElement {
  if (profile.imageUrl) {
    const img = h("img", {
      src: profile.imageUrl,
      alt: "",
      loading: "lazy",
      referrerpolicy: "no-referrer",
      class: "avatar-img",
    });
    img.addEventListener("error", () =>
      img.replaceWith(document.createTextNode(initials(profile.fullName))),
    );
    return h(
      "span",
      { class: `avatar ${extraClass}`.trim(), "aria-hidden": "true" },
      img,
    );
  }
  return h(
    "span",
    { class: `avatar ${extraClass}`.trim(), "aria-hidden": "true" },
    initials(profile.fullName),
  );
}

export function createAuthUI({ root, toast, onSignIn }: AuthOptions): AuthUI {
  const authBody = root.querySelector<HTMLElement>("[data-auth-body]");
  const authJson = root.querySelector<HTMLElement>("[data-auth-json]");
  const repoSlot = root.querySelector<HTMLElement>("[data-repo-action]");
  const localRows = {
    profile: root.querySelector<HTMLElement>("[data-local-profile]"),
    provider: root.querySelector<HTMLElement>("[data-local-provider]"),
    repo: root.querySelector<HTMLElement>("[data-local-repo]"),
    status: root.querySelector<HTMLElement>("[data-auth-status]"),
  };
  const forgetStored = root.querySelector<HTMLButtonElement>(
    '[data-auth-action="forget-stored"]',
  );
  const navButtons = [
    ...root.querySelectorAll<HTMLElement>("[data-auth-open]"),
  ];

  let clerk: Clerk | null = null;
  let clerkPromise: Promise<Clerk> | null = null;
  let clerkStatus: "idle" | "loading" | "ready" | "error" = "idle";
  let clerkError = "";

  const clerkConfigured = Boolean(CLERK_KEY);

  function firstName(profile: LocalProfile): string {
    return profile.firstName || profile.fullName.split(/\s+/)[0] || "Account";
  }

  function syncClerkUser(user: Clerk["user"]): void {
    if (!user) {
      const current = localAuth.active();
      if (current?.provider === "clerk") localAuth.signOut();
      render();
      return;
    }
    const primary = user.primaryEmailAddress?.emailAddress;
    localAuth.save({
      id: user.id,
      fullName: user.fullName ?? user.username ?? primary ?? undefined,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      username: user.username ?? undefined,
      email: primary,
      imageUrl: user.imageUrl,
      provider: "clerk",
      createdAt: user.createdAt
        ? new Date(user.createdAt).getTime()
        : undefined,
    });
    render();
    onSignIn?.();
  }

  async function loadClerk(): Promise<Clerk> {
    if (clerk) return clerk;
    if (clerkPromise) return clerkPromise;
    clerkStatus = "loading";
    clerkError = "";
    clerkPromise = (async () => {
      if (!clerkConfigured)
        throw new Error("Clerk publishable key is not configured.");
      const [{ Clerk }, { ui }] = await Promise.all([
        import("@clerk/clerk-js"),
        import("@clerk/ui"),
      ]);
      const instance = new Clerk(CLERK_KEY);
      await instance.load({ appearance: CLERK_APPEARANCE, ui });
      instance.addListener((resources) => syncClerkUser(resources.user));
      if (import.meta.env.DEV)
        (
          window as unknown as { __shotincleanClerk?: Clerk }
        ).__shotincleanClerk = instance;
      clerk = instance;
      clerkStatus = "ready";
      if (instance.user) syncClerkUser(instance.user);
      return instance;
    })().catch((error: unknown) => {
      clerkStatus = "error";
      clerkError =
        error instanceof Error ? error.message : "Clerk could not be loaded.";
      clerkPromise = null;
      throw error;
    });
    return clerkPromise;
  }

  async function openSignIn(): Promise<void> {
    if (clerk) {
      clerk.openSignIn();
      return;
    }
    if (!clerkConfigured) {
      root
        .querySelector<HTMLElement>("#account")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    clerkStatus = "loading";
    render();
    try {
      const instance = await loadClerk();
      clerkStatus = "ready";
      render();
      instance.openSignIn();
    } catch {
      render();
      toast(
        "Clerk could not open. Check the publishable key and allowed origins.",
        "error",
      );
    }
  }

  function signedOutView(): HTMLElement {
    if (!clerkConfigured) {
      return h(
        "div",
        { class: "auth-view" },
        h("span", { class: "auth-kicker" }, iconEl("lock"), "Studio locked"),
        h("h3", {}, "Clerk is not configured."),
        h(
          "p",
          {},
          "The studio requires a Clerk account. Add a publishable key to enable sign-in; the landing page itself stays public.",
        ),
        h(
          "p",
          { class: "auth-setup" },
          "Add ",
          h("code", {}, "VITE_CLERK_PUBLISHABLE_KEY"),
          " to your environment and rebuild. The key is public by design.",
        ),
      );
    }

    return h(
      "div",
      { class: "auth-view" },
      h("span", { class: "auth-kicker" }, iconEl("signIn"), "Clerk account"),
      h("h3", {}, "Sign in to open the studio."),
      h(
        "p",
        {},
        "Clerk handles the account. This page keeps only your name, avatar URL and timestamps in localStorage. The studio stays locked until you sign in.",
      ),
      h(
        "button",
        {
          class: "btn btn-primary auth-main-action",
          type: "button",
          "data-auth-action": "signin",
          disabled: clerkStatus === "loading",
        },
        clerkStatus === "loading" ? iconEl("spinner") : iconEl("signIn"),
        clerkStatus === "loading" ? "Opening Clerk..." : "Sign in",
      ),
      clerkStatus === "error"
        ? h(
            "p",
            { class: "auth-error", role: "alert" },
            iconEl("warningCircle"),
            clerkError ||
              "Clerk could not load. Check the key and allowed origins.",
          )
        : null,
      h(
        "p",
        { class: "auth-note" },
        iconEl("shieldCheck"),
        "No password is handled by this page. Captures are never sent to Clerk.",
      ),
    );
  }

  function profileView(profile: LocalProfile): HTMLElement {
    const provider =
      profile.provider === "clerk" ? "Clerk account" : "Local profile";
    return h(
      "div",
      { class: "auth-view" },
      h(
        "div",
        { class: "auth-profile" },
        avatarEl(profile, "avatar-lg"),
        h(
          "div",
          { class: "auth-profile-copy" },
          h("h3", {}, profile.fullName),
          h("p", {}, profile.email || `@${profile.username || "local"}`),
          h(
            "div",
            { class: "auth-badges" },
            h("span", { class: "badge badge-accent" }, provider),
            h(
              "span",
              { class: "badge" },
              `Since ${formatMemberDate(profile.createdAt)}`,
            ),
          ),
        ),
      ),
      h(
        "div",
        { class: "auth-actions" },
        h(
          "a",
          { class: "btn btn-primary", href: "#/app" },
          iconEl("play"),
          "Open the studio",
        ),
        h(
          "button",
          { class: "btn", type: "button", "data-auth-action": "signout" },
          "Sign out",
        ),
      ),
      h(
        "p",
        { class: "auth-note" },
        iconEl("hardDrives"),
        "Profile record saved on this device. Media stays in the studio's IndexedDB.",
      ),
      h(
        "button",
        {
          class: "auth-danger",
          type: "button",
          "data-auth-action": "forget",
        },
        "Delete local profile",
      ),
    );
  }

  function render(): void {
    const active = localAuth.active();
    // Only a Clerk profile unlocks the studio. A legacy local profile can
    // still be forgotten, but it is treated as signed out.
    const profile = active?.provider === "clerk" ? active : null;
    const stored = active ?? localAuth.all()[0] ?? null;

    if (authBody) {
      authBody.replaceChildren(
        profile ? profileView(profile) : signedOutView(),
      );
    }

    for (const button of navButtons) {
      if (profile) {
        button.classList.add("is-profile");
        button.replaceChildren(
          avatarEl(profile, "avatar-xs"),
          h("span", { class: "nav-account-name" }, firstName(profile)),
        );
        button.setAttribute("aria-label", `Account for ${profile.fullName}`);
        button.removeAttribute("title");
      } else {
        button.classList.remove("is-profile");
        button.replaceChildren(document.createTextNode("Sign in"));
        button.setAttribute("aria-label", "Sign in to open the studio");
      }
    }

    if (localRows.profile)
      localRows.profile.textContent = stored
        ? profile
          ? "Saved"
          : "Saved, signed out"
        : "None";
    if (localRows.provider)
      localRows.provider.textContent = stored
        ? stored.provider === "clerk"
          ? "Clerk"
          : "Local"
        : "Required";
    if (localRows.status)
      localRows.status.textContent = profile ? "Signed in" : "Required";
    if (localRows.repo)
      localRows.repo.textContent = profile ? "Unlocked" : "Locked";
    if (forgetStored) forgetStored.hidden = !stored || Boolean(profile);

    if (repoSlot) {
      if (profile) {
        repoSlot.replaceChildren(
          h(
            "a",
            {
              class: "btn btn-primary repo-btn",
              href: REPO_URL,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            iconEl("github"),
            "Open repository",
            iconEl("arrowUpRight"),
          ),
        );
      } else {
        repoSlot.replaceChildren(
          h(
            "span",
            { class: "repo-lock" },
            iconEl("lock"),
            "Sign in to unlock",
          ),
        );
      }
    }

    if (authJson) {
      authJson.textContent = stored
        ? JSON.stringify(
            {
              id: stored.id,
              name: stored.fullName,
              email: stored.email ?? null,
              provider: stored.provider,
              active: Boolean(profile),
              scope: profileScope(stored),
              savedAt: new Date(stored.savedAt).toISOString(),
            },
            null,
            2,
          )
        : "No profile saved on this device.";
    }
  }

  async function signOut(): Promise<void> {
    const profile = localAuth.active();
    if (profile?.provider === "clerk" && clerkConfigured) {
      try {
        const instance = clerk ?? (await loadClerk());
        await instance.signOut();
      } catch {
        // The local profile still signs out even if Clerk's network call fails.
      }
    }
    localAuth.signOut();
    render();
    toast("Signed out. The studio is locked again.");
  }

  async function forget(): Promise<void> {
    const profile = localAuth.active();
    if (!profile) return;
    if (
      !confirm(
        `Delete the local profile for ${profile.fullName}? Captures in the studio are kept.`,
      )
    )
      return;
    if (profile.provider === "clerk" && clerkConfigured) {
      try {
        const instance = clerk ?? (await loadClerk());
        await instance.signOut();
      } catch {
        // Local deletion proceeds either way.
      }
    }
    localAuth.remove(profile.id);
    render();
    toast("Local profile deleted.");
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action =
      target.closest<HTMLElement>("[data-auth-action]")?.dataset.authAction;
    if (action === "signin") {
      event.preventDefault();
      void openSignIn();
    } else if (action === "signout") {
      event.preventDefault();
      void signOut();
    } else if (action === "forget") {
      event.preventDefault();
      void forget();
    } else if (action === "forget-stored") {
      event.preventDefault();
      const stored = localAuth.all()[0];
      if (!stored) return;
      if (
        !confirm(
          `Forget the saved local profile for ${stored.fullName}? Captures in the studio are kept.`,
        )
      )
        return;
      localAuth.remove(stored.id);
      render();
      toast("Saved profile forgotten.");
    }
  });

  for (const button of navButtons) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (localAuth.active()?.provider === "clerk") {
        root
          .querySelector<HTMLElement>("#account")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        void openSignIn();
      }
    });
  }

  const unsubscribe = localAuth.onChange(render);
  const initial = localAuth.active();
  if (initial) localAuth.touch();
  render();

  return {
    open: () => {
      if (localAuth.active()?.provider === "clerk") {
        root
          .querySelector<HTMLElement>("#account")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        void openSignIn();
      }
    },
    render,
    destroy: unsubscribe,
  } as AuthUI & { destroy(): void };
}
