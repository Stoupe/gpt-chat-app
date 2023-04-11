/* eslint-disable @typescript-eslint/no-misused-promises */
import { type NextPage } from "next";
import { signIn, useSession } from "next-auth/react";
import Head from "next/head";

const Home: NextPage = () => {
  const session = useSession();

  if (!session.data) {
    return (
      <button className="btn-outline btn" onClick={() => signIn("github")}>
        <a>sign in with github</a>
      </button>
    );
  }

  return (
    <>
      <Head>
        <title>GPT Chat App</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex h-screen w-full items-center justify-center italic">
        select or create a new chat to begin
      </div>
    </>
  );
};

export default Home;
