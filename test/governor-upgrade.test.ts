import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";
import { makeLineOfCredit, makeDaoVoters } from "../helpers/contract-helpers";

describe("governor-upgrade", function() {
  let testEnv: TestEnv;

  beforeEach(async () => {
    testEnv = await createTestEnv();
  });

  describe("governor-upgrade reinitializer", () => {
    it("upgrades the govenor contract", async () => {
      const { thurmanGov } = testEnv;
      const oldImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGov.address);
      const ThurmanGov2: ThurmanGovernor2 = await ethers.getContractFactory("ThurmanGovernor2");
      const thurmanGov2 = await upgrades.upgradeProxy(
        thurmanGov.address, 
        ThurmanGov2,
        {
          call: {fn: "initializeV2", args: [5, 40, 0]}
        }
      );
      const newImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGov.address);
      expect(oldImplementation).to.not.equal(newImplementation);
    });

    it("cannot be initialized more than once", async () => {
      const { thurmanGov } = testEnv;
      const oldImplementation = await upgrades.erc1967.getImplementationAddress(thurmanGov.address);
      const ThurmanGov2: ThurmanGovernor2 = await ethers.getContractFactory("ThurmanGovernor2");
      const thurmanGov2 = await upgrades.upgradeProxy(
        thurmanGov.address, 
        ThurmanGov2,
        {
          call: {fn: "initializeV2", args: [5, 40, 0]}
        }
      );

      await expect(upgrades.upgradeProxy(
        thurmanGov.address, 
        ThurmanGov2,
        {
          call: {fn: "initializeV2", args: [0, 42, 0]}
        }
      )).to.be.revertedWith("Initializable: contract is already initialized");
    })
  });

  describe("governor-upgrade change-governance-settings", () => {
    it("updates governance settings", async () => {
      const { users, polemarch, weth, sWETH, dWETH, gWETH, thurmanGov, timelock } = testEnv;
      let proposalDescription = "Change voting delay";
      const ThurmanGov2: ThurmanGovernor2 = await ethers.getContractFactory("ThurmanGovernor2");
      const thurmanGov2 = await upgrades.upgradeProxy(
        thurmanGov.address, 
        ThurmanGov2,
        {
          call: {fn: "initializeV2", args: [5, 40, 0]}
        }
      );

      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );

      await makeDaoVoters(testEnv, "3");

      const voteDelayCallData = thurmanGov2.interface.encodeFunctionData("setVotingDelay", [5]);
      const votePeriodCallData = thurmanGov2.interface.encodeFunctionData("setVotingPeriod", [45]);
      const proposalThreshCallData = thurmanGov2.interface.encodeFunctionData("setProposalThreshold", [1]);
      const timelockDelayCallData = timelock.interface.encodeFunctionData("updateDelay", [1]);

      await thurmanGov2["propose(address[],uint256[],bytes[],string)"](
        [thurmanGov2.address, thurmanGov2.address, thurmanGov2.address, timelock.address],
        [0, 0, 0, 0],
        [voteDelayCallData, votePeriodCallData, proposalThreshCallData, timelockDelayCallData],
        proposalDescription
      );

      let filterFrom = thurmanGov2.filters.ProposalCreated(null);
      let data = await thurmanGov2.queryFilter(filterFrom, -10000);
      const proposalId = data[0].args[0];

      await hre.network.provider.send("hardhat_mine", ["0x5"]);
      
      await thurmanGov2.castVote(proposalId, 1);
      for (let i = 0; i < users.length; i++) {
        await thurmanGov2.connect(users[i]).castVote(proposalId, 1);
      }

      await hre.network.provider.send("hardhat_mine", ["0x28"]);

      let descriptionHash = ethers.utils.id(proposalDescription);
      await thurmanGov2["queue(address[],uint256[],bytes[],bytes32)"](
        [thurmanGov2.address, thurmanGov2.address, thurmanGov2.address, timelock.address],
        [0, 0, 0, 0],
        [voteDelayCallData, votePeriodCallData, proposalThreshCallData, timelockDelayCallData],
        descriptionHash
      );

      await hre.network.provider.send("hardhat_mine", ["0x19B4"]);

      await thurmanGov2["execute(address[],uint256[],bytes[],bytes32)"](
        [thurmanGov2.address, thurmanGov2.address, thurmanGov2.address, timelock.address],
        [0, 0, 0, 0],
        [voteDelayCallData, votePeriodCallData, proposalThreshCallData, timelockDelayCallData],
        descriptionHash
      );

      expect(await thurmanGov2.votingDelay()).to.equal(5);
      expect(await thurmanGov2.votingPeriod()).to.equal(45);
      expect(await thurmanGov2.proposalThreshold()).to.equal(1);
      expect(await timelock.getMinDelay()).to.equal(1);
    });
  });
})