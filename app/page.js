"use client";

import { Box, Button, Stack, TextField } from "@mui/material";
import { useState } from "react";

export default function Home() {
	const [messages, setMessages] = useState([
		{
			role: "assistant",
			content:
				"Hi! I'm the Rate My Professor support assistant. How can I help you today?",
		},
	]);
	const [message, setMessage] = useState("");

	const sendMessage = async () => {
		setMessages = (messages) => [
			...messages,
			{ role: "user", content: message },
			{ role: "assistant", content: "" },
		];

		setMessage("");
		const response = fetch("/api/json", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([...messages, { role: "user", content: message }]),
		}).then(async (res) => {
			const reader = res.body.getReader();
			const decoder = new TextDecoder();

			let result = "";
			return reader.read().then(function processText({ done, value }) {
				if (done) {
					return result;
				}

				const text = decoder.decode(value || new Uint8Array(), {
					stream: true,
				});

				setMessages((messages) => {
					let lastMessage = messages[messages.length - 1];
					let otherMessages = messages.slice(0, messages.length - 1);

					return [
						...otherMessages,
						{ ...lastMessage, content: lastMessage.content + text },
					];
				});
			});
		});
	};

	return (
		<main className="flex min-h-screen flex-col items-center justify-between p-24">
			<div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
				<Box
					width="100vw"
					height="100vh"
					display="flex"
					flexDirection="column"
					justifyContent="center"
					alignItems="center"
				>
					<Stack
						direction="column"
						width="500px"
						height="700px"
						border="1px solid black"
						padding={2}
						spacing={3}
					>
						<Stack
							direction="column"
							spacing={2}
							flexGrow={1}
							overflow="hidden"
							maxHeight="100%"
						>
							{messages.map((message, index) => {
								<Box
									key={index}
									display="flex"
									justifyContent={
										message.role === "assistant" ? "flex-start" : "flex-end"
									}
								>
									<Box
										bgcolor={
											message.role === "assistant"
												? "primary.main"
												: "secondary"
										}
										color="white"
										borderRadius={16}
										p={3}
									></Box>
								</Box>;
							})}
						</Stack>
					</Stack>
          <Stack
            direction="row" spacing={2}>
              <TextField
                label="Message"
                fullWidth
                value={message}
                onChange={(e) => {
                  setMessage[e.target.value]
                }}
              />
              <Button variant="contained" onClick={sendMessage}>
                Send
              </Button>
            </Stack>
				</Box>
			</div>
		</main>
	);
}
