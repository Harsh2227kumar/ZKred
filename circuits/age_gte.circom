pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// Proves "the holder was born on or before cutoff_days" without revealing the date of birth.
//
// Binding to the signed credential: the issuer BBS-signs dob_commitment = Poseidon(dob_days, salt)
// (GovernmentId message 13). The holder reveals dob_commitment in the BBS proof and proves here that
// they know (dob_days, salt) behind it.
//
// Dates are whole days since 1900-01-01 (UTC); 16 bits covers dates up to 2079-06-06.
// The verifier computes cutoff_days = (its own today − N calendar years) and accepts any proof whose
// cutoff_days is ≤ its own: an older proof only makes the claim stronger.
template AgeGte() {
    signal input dob_days;        // private
    signal input salt;            // private (field element)
    signal input dob_commitment;  // public
    signal input cutoff_days;     // public

    // Range checks make the 17-bit comparator below sound.
    component dobBits = Num2Bits(16);
    dobBits.in <== dob_days;
    component cutoffBits = Num2Bits(16);
    cutoffBits.in <== cutoff_days;

    component hash = Poseidon(2);
    hash.inputs[0] <== dob_days;
    hash.inputs[1] <== salt;
    hash.out === dob_commitment;

    component bornBefore = LessEqThan(17);
    bornBefore.in[0] <== dob_days;
    bornBefore.in[1] <== cutoff_days;
    bornBefore.out === 1;
}

component main { public [dob_commitment, cutoff_days] } = AgeGte();
