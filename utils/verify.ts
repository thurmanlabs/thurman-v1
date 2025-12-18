import { run } from "hardhat";

export const verify = async function(contractAddress: string, args: any) {
  console.log("Verifying contract...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase() || "";
    if (errorMessage.includes("already verified")) {
      console.log("Already verified");
    } else if (errorMessage.includes("403") || errorMessage.includes("error code: 1000")) {
      console.log(`Etherscan API error (403): Skipping verification for ${contractAddress}. This may be due to API key issues or rate limiting.`);
      console.log("You can verify manually on Etherscan or try again later.");
    } else if (errorMessage.includes("failed to obtain list of solc versions")) {
      console.log(`Etherscan API error: Skipping verification for ${contractAddress}. Unable to fetch Solidity compiler versions.`);
      console.log("You can verify manually on Etherscan or try again later.");
    } else {
      console.log(`Verification failed for ${contractAddress}:`, errorMessage);
      console.log("You can verify manually on Etherscan.");
    }
  }
};