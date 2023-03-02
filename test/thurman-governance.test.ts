import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";
import { makeLineOfCredit } from "../helpers/contract-helpers";

describe("Thurman Goverance", function() {
  let testEnv: TestEnv;

  beforeEach(async () => {
    testEnv = await createTestEnv();
  });

  describe("governance", () => {
    it("creates a line of credit", async () => {
      await weth.deposit({ value: parseEther("10.0") });
      await weth.connect(users[1]).deposit({ value: parseEther("10.0")});
      await weth.connect(users[2]).deposit({ value: parseEther("10.0")});
      
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      
      await weth.approve(polemarch.address, parseEther("10.0"));
      await weth.connect(users[1]).approve(polemarch.address, parseEther("10.0"));
      await weth.connect(users[2]).approve(polemarch.address, parseEther("10.0"));

      await polemarch.supply(weth.address, parseEther("10.0"));
      await polemarch.connect(users[1]).supply(weth.address, parseEther("10.0"));
      await polemarch.connect(users[2]).supply(weth.address, parseEther("10.0"));

      await thurman.delegate(deployer.address);
      await thurman.connect(users[1]).delegate(users[1].address);
      await thurman.connect(users[2]).delegate(users[2].address);

      await polemarch.setExchequerBorrowing(weth.address, true);

      const locCallData = polemarch.interface.encodeFunctionData("createLineOfCredit", [
        users[3].address,
        weth.address,
        parseEther("10.0"),
        parseEther("20.0"),
        14
      ]);

      const proposalDescription = "Proposal #1: Create a line of credit for User #3";

      await thurmanGov["propose(address[],uint256[],bytes[],string)"](
        [polemarch.address],
        [0],
        [locCallData],
        proposalDescription,
      );
      
      let filterFrom = thurmanGov.filters.ProposalCreated(null);
      let data = await thurmanGov.queryFilter(filterFrom, -10000);
      const proposalId = data[0].args[0];

      await hre.network.provider.send("hardhat_mine", ["0x19C8"]);
   
      await thurmanGov.castVote(proposalId, 1);
      await thurmanGov.connect(users[1]).castVote(proposalId, 1);
      await thurmanGov.connect(users[2]).castVote(proposalId, 1);
  
      await hre.network.provider.send("hardhat_mine", ["0xB3E2"]);

      let descriptionHash = ethers.utils.id(proposalDescription);
      await thurmanGov["queue(address[],uint256[],bytes[],bytes32)"](
        [polemarch.address],
        [0],
        [locCallData],
        descriptionHash
      );

      await hre.network.provider.send("hardhat_mine", ["0x19B4"]);

      await expect(thurmanGov["execute(address[],uint256[],bytes[],bytes32)"](
        [polemarch.address],
        [0],
        [locCallData],
        descriptionHash
      )).to.emit(polemarch, "CreateLineOfCredit");
    });

    it("tests out makeLineOfCredit function", async () => {
      const { polemarch, weth, sWETH, dWETH } = testEnv;
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      expect(await makeLineOfCredit(testEnv, proposalDescription, "10.0", borrowerIndex, "10.0", "20.0", 14))
        .to.emit(polemarch, "CreateLineOfCredit");
    })
  });
});