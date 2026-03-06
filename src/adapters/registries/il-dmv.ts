import axios from "axios";

// IDScan axios stub for Illinois DMV (MVP10)
export async function verifyIllinoisDL(
  dlNumber: string,
  dob: string,
): Promise<boolean> {
  // Stub for MVP10 - assume valid if not empty
  if (!dlNumber || !dob) {
    return false;
  }

  try {
    // AXIOS stub - in MVP10 we bypass actual API call
    // await axios.post('https://api.idscan.net/dvs', { state: 'IL', id: dlNumber, dob });
    return true; // MVP stub returns true
  } catch (error) {
    console.error("IDScan API Error:", error);
    return false;
  }
}
