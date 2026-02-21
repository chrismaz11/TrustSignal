const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AnchorRegistry", function () {
  let AnchorRegistry;
  let registry;
  let owner1, owner2, owner3, owner4, owner5, nonOwner, addr1;
  let owners;

  beforeEach(async function () {
    [owner1, owner2, owner3, owner4, owner5, nonOwner, addr1] = await ethers.getSigners();
    owners = [owner1.address, owner2.address, owner3.address, owner4.address, owner5.address];

    AnchorRegistry = await ethers.getContractFactory("AnchorRegistry");
    registry = await AnchorRegistry.deploy(owners);
    // Hardhat ^6.x: no await registry.deployed() needed usually, but let's wait for tx
    if (registry.waitForDeployment) {
      await registry.waitForDeployment();
    } else {
      await registry.deployed();
    }
  });

  describe("Deployment", function () {
    it("Should set the threshold and owners correctly", async function () {
      expect(await registry.THRESHOLD()).to.equal(3);
      for (let i = 0; i < 5; i++) {
        expect(await registry.owners(i)).to.equal(owners[i]);
        expect(await registry.isOwner(owners[i])).to.equal(true);
      }
    });

    it("Should reject deployment with incorrect number of owners", async function () {
      const invalidOwners = [owner1.address, owner2.address];
      await expect(AnchorRegistry.deploy(invalidOwners)).to.be.revertedWith("Must have exactly 5 owners");
    });
  });

  describe("Anchoring", function () {
    it("Should anchor a hash and emit event", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("receipt1"));
      
      const tx = await registry.connect(addr1).anchor(hash);
      await expect(tx).to.emit(registry, "Anchored").withArgs(
        hash,
        ethers.anyValue,
        addr1.address,
        ethers.anyValue
      );
      
      expect(await registry.isAnchored(hash)).to.equal(true);
    });

    it("Should prevent duplicate anchors", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("receipt1"));
      await registry.connect(addr1).anchor(hash);
      
      await expect(registry.connect(addr1).anchor(hash)).to.be.revertedWith("Already anchored");
    });
  });

  describe("Multisig Actions", function () {
    it("Should pause the contract with 3 of 5 approvals", async function () {
      // Owner 1 submits Pause (ActionType 0)
      await registry.connect(owner1).submitProposal(0, ethers.ZeroAddress, ethers.ZeroAddress);
      
      expect(await registry.paused()).to.equal(false);

      // Owner 2 approves
      await registry.connect(owner2).approveProposal(0);
      expect(await registry.paused()).to.equal(false);

      // Owner 3 approves (Threshold met)
      await registry.connect(owner3).approveProposal(0);
      expect(await registry.paused()).to.equal(true);

      // Should not be able to anchor when paused
      const hash = ethers.keccak256(ethers.toUtf8Bytes("receipt2"));
      await expect(registry.connect(addr1).anchor(hash)).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });

    it("Should unpause the contract with 3 of 5 approvals", async function () {
      await registry.connect(owner1).submitProposal(0, ethers.ZeroAddress, ethers.ZeroAddress);
      await registry.connect(owner2).approveProposal(0);
      await registry.connect(owner3).approveProposal(0);
      expect(await registry.paused()).to.equal(true);

      // Owner 1 submits Unpause (ActionType 1)
      await registry.connect(owner1).submitProposal(1, ethers.ZeroAddress, ethers.ZeroAddress);
      await registry.connect(owner2).approveProposal(1);
      await registry.connect(owner3).approveProposal(1);
      
      expect(await registry.paused()).to.equal(false);
    });

    it("Should replace an owner with 3 of 5 approvals", async function () {
      const oldOwner = owner5.address;
      const newOwner = addr1.address;
      
      // Submit ReplaceOwner (ActionType 2)
      await registry.connect(owner1).submitProposal(2, oldOwner, newOwner);
      await registry.connect(owner2).approveProposal(0);
      
      const tx = await registry.connect(owner3).approveProposal(0);
      await expect(tx).to.emit(registry, "OwnerReplaced").withArgs(oldOwner, newOwner);

      expect(await registry.isOwner(oldOwner)).to.equal(false);
      expect(await registry.isOwner(newOwner)).to.equal(true);

      // The new owner can now submit a proposal
      await registry.connect(addr1).submitProposal(0, ethers.ZeroAddress, ethers.ZeroAddress);
    });

    it("Only owners can submit and approve proposals", async function () {
      await expect(registry.connect(nonOwner).submitProposal(0, ethers.ZeroAddress, ethers.ZeroAddress)).to.be.revertedWith("Not an owner");
      
      await registry.connect(owner1).submitProposal(0, ethers.ZeroAddress, ethers.ZeroAddress);
      
      await expect(registry.connect(nonOwner).approveProposal(0)).to.be.revertedWith("Not an owner");
    });
  });
});
