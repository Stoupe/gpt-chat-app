"use client";

import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";

const Home: NextPage = () => {
  const session = useSession();

  if (!session.data) {
    return null;
  }

  return (
    <>
      <Head>
        <title>GPT Chat App</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="hidden h-screen w-full items-center justify-center italic sm:flex">
        select or create a new chat to begin
      </div>
    </>
  );
};

export default Home;
