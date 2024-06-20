import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther, DataHexString, BigNumber } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { WETH_DECIMALS, TestEnv } from "../test/setup";

export async function makeLineOfCredit(
  testEnv: TestEnv,
  proposalDescription: string,
  supplyAmount: string,
  borrowerIndex: number,
  eventIndex: number,
  borrowMax: string,
  rate: string,
  termDays: number
) {
  const {
    deployer,
    users,
    polemarch,
    weth,
    thurmanGov
  } = testEnv;

  await makeDaoVoters(testEnv, supplyAmount);

  await polemarch.setExchequerBorrowing(weth.address, true);

  // let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
  const { locCallData, proposalId } = await makeLocProposal(
    testEnv,
    borrowMax,
    rate,
    termDays,
    borrowerIndex,
    eventIndex,
    proposalDescription
  );

  await hre.network.provider.send("hardhat_mine", ["0x19C8"]);
  
  await thurmanGov.castVote(proposalId, 1);
  for (let i = 0; i < users.length; i++) {
    await thurmanGov.connect(users[i]).castVote(proposalId, 1);
  }

  await hre.network.provider.send("hardhat_mine", ["0xB3E2"]);

  let descriptionHash = ethers.utils.id(proposalDescription);
  await thurmanGov["queue(address[],uint256[],bytes[],bytes32)"](
    [polemarch.address],
    [0],
    [locCallData],
    descriptionHash
  );

  await hre.network.provider.send("hardhat_mine", ["0x19B4"]);

  await thurmanGov["execute(address[],uint256[],bytes[],bytes32)"](
    [polemarch.address],
    [0],
    [locCallData],
    descriptionHash
  );
}

export async function makeDaoVoters(testEnv: TestEnv, supplyAmount: string) {
  const {
    deployer,
    users,
    weth,
    sWETH,
    dWETH,
    polemarch,
    thurman
  } = testEnv;

  await weth.deposit({ value: parseEther(supplyAmount) });
  for (let i = 0; i < users.length; i++) {
    await weth.connect(users[i]).deposit({ value: parseEther(supplyAmount)});
  }

  // await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);

  await weth.approve(polemarch.address, parseEther(supplyAmount));
  for (let i = 0; i < users.length; i++) {
    await weth.connect(users[i]).approve(polemarch.address, parseEther(supplyAmount));
  }

  await polemarch.supply(weth.address, parseEther(supplyAmount));
  for (let i = 0; i < users.length; i++) {
    await polemarch.connect(users[i]).supply(weth.address, parseEther(supplyAmount));
  }

  await thurman.delegate(deployer.address);
  for (let i = 0; i < users.length; i++) {
    await thurman.connect(users[i]).delegate(users[i].address);
  }
}

export async function makeLocProposal(
  testEnv: TestEnv,
  borrowMax: string,
  rate: string,
  termDays: number,
  borrowerIndex: number,
  eventIndex: number,
  proposalDescription: string
): { locCallData: DataHexString, proposalId: BigNumber } {
  const {
    deployer,
    users,
    weth,
    polemarch,
    thurmanGov
  } = testEnv;
  
  const locCallData = polemarch.interface.encodeFunctionData("createLineOfCredit", [
    users[borrowerIndex].address,
    weth.address,
    parseEther(borrowMax),
    parseEther(rate),
    termDays
  ]);

  await thurmanGov["propose(address[],uint256[],bytes[],string)"](
    [polemarch.address],
    [0],
    [locCallData],
    proposalDescription,
  );

  let filterFrom = thurmanGov.filters.ProposalCreated(null);
  let data = await thurmanGov.queryFilter(filterFrom, -1000000);
  const proposalId = data[eventIndex].args[0];
  return { locCallData, proposalId };
}