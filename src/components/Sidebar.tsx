import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { api } from "~/utils/api";

const Sidebar = () => {
  const { query, replace } = useRouter();
  const chatId = query.chatId as string | undefined;

  const session = useSession();
  const { data: chats, refetch } = api.chat.getAll.useQuery();
  const { mutateAsync: createNewChat } = api.chat.create.useMutation({
    onSuccess: (chat) => {
      if (chat) {
        void refetch();
        void replace(`/chat/${chat?.id}`);
      }
    },
  });

  return (
    <div className="flex h-screen w-64 flex-col justify-between border-r bg-base-200">
      <div className="flex h-full flex-col justify-between py-6">
        <nav aria-label="Main Nav" className="flex flex-col gap-y-2 px-4">
          {chats?.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className="flex items-center gap-2 rounded-lg border-2 border-neutral-300 border-opacity-0 bg-base-300 px-4 py-2 text-base-content transition-all hover:border-opacity-100 hover:text-base-content"
            >
              {chat.id === chatId && <span>👉</span>}
              <span className="text-sm font-medium">{chat.name}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4">
          <button
            className="btn-outline btn w-full"
            onClick={(e) => {
              e.preventDefault();
              void createNewChat();
            }}
          >
            New chat
          </button>
        </div>
      </div>

      <div className="sticky inset-x-0 bottom-0 border-t border-gray-100">
        <div
          onClick={() => {
            void signOut();
          }}
          className="flex cursor-pointer items-center gap-2 bg-base-100 p-4 hover:bg-gray-50"
        >
          {session.data?.user ? (
            <>
              <Image
                width={10}
                height={10}
                alt="Profile image"
                src={session.data.user.image ?? ""}
                className="h-10 w-10 rounded-full object-cover"
              />

              <div>
                <p className="text-xs">
                  <strong className="block font-medium">
                    {session.data?.user.name}
                  </strong>

                  <span> {session.data?.user.email} </span>
                </p>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                void signIn("github");
              }}
            >
              Sign in with Github
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
