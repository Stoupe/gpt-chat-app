"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { api } from "~/utils/api";

const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const session = useSession();
  const user = session.data?.user;
  const isAuthed = !!user;

  const utils = api.useContext();

  const { data: chats, refetch } = api.chat.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { mutateAsync: createNewChat } = api.chat.create.useMutation({
    onSuccess: (chat) => {
      if (chat) {
        void refetch();
        void router.replace(`/chat/${chat?.id}`);
      }
    },
  });

  const { mutate: updateApiKey } = api.user.createApiKey.useMutation({
    onSuccess: () => {
      void utils.user.getApiKey.invalidate();
    },
  });

  return (
    <div
      className={`flex h-screen w-screen flex-col justify-between border-r bg-base-200 sm:flex sm:w-64`}
    >
      <div className="flex h-full flex-col justify-between gap-2 overflow-y-scroll p-4">
        {isAuthed && (
          <>
            <nav aria-label="Main Nav" className="flex flex-col gap-y-2">
              {chats?.map((chat) => (
                <Link
                  // prefetch={false}
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-center gap-2 rounded-lg border-2 border-neutral-300 border-opacity-0 bg-base-300 px-4 py-2 text-sm font-medium text-base-content transition-all hover:border-opacity-100 hover:text-base-content"
                >
                  <span>
                    {pathname?.endsWith(chat.id) && "👉"} {chat.name}
                  </span>
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>

      {isAuthed && (
        <>
          <div className="flex flex-col gap-2 border-t-2 p-4">
            <button
              className={`btn w-full ${
                (chats ?? []).length > 0 ? "btn-outline" : ""
              }`}
              onClick={(e) => {
                e.preventDefault();
                void createNewChat();
              }}
            >
              New chat
            </button>

            <button
              className="btn-ghost btn-sm btn w-full"
              onClick={() => {
                const dialogResponse = window.prompt(
                  "Enter your OpenAI API Key\nhttps://platform.openai.com/account/api-keys\n\n(NOTE: KEYS ARE CURRENTLY STORED IN PLAINTEXT)"
                );
                if (!dialogResponse) return;
                void updateApiKey({ apiKey: dialogResponse });
              }}
            >
              Update OpenAI API Key
            </button>
          </div>

          <div className="flex w-full items-center justify-between bg-white p-4">
            <div className="flex items-center gap-2">
              {/* PROFILE IMAGE */}
              <Image
                width={100}
                height={100}
                alt="Profile image"
                src={user.image ?? ""}
                className="h-10 w-10 rounded-full object-cover"
              />

              {/* PROFILE NAME & EMAIL */}
              <div>
                <div className="flex flex-col text-start text-xs">
                  <span className=" font-medium">{user.name}</span>
                  <span>{user.email}</span>
                </div>
              </div>
            </div>

            {/* LOGOUT BUTTON */}
            <button
              name="Logout"
              className="btn-ghost btn-square btn border-base-200"
              onClick={() => {
                void signOut();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
            </button>
          </div>
        </>
      )}

      {!isAuthed && (
        <div className="flex w-full items-center justify-between bg-white p-4">
          <button
            className="btn-outline btn w-full"
            onClick={() => void signIn("github")}
          >
            Sign in with Github
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
