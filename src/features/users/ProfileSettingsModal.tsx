import { FormEvent, useState } from "react";
import { useApp } from "../../app/AppProvider";
import { backendAuth } from "../../services/apiClient";
import { FormInput, Modal, ProfilePhotoField } from "../../shared/ui";
import { deleteReplacedProfilePhoto, discardDraftProfilePhoto } from "../../shared/profilePhotos";
import type { User } from "../../types";

export function ProfileSettingsModal({ onClose }: { onClose: () => void }) {
  const { currentUser, updateUser, refreshData, showToast, logActivity } = useApp();
  const [name, setName] = useState(currentUser.name);
  const [profileImageUrl, setProfileImageUrl] = useState(currentUser.profileImageUrl ?? "");
  const [profileImageKey, setProfileImageKey] = useState(currentUser.profileImageKey ?? "");
  const [savedProfileImageKey, setSavedProfileImageKey] = useState(currentUser.profileImageKey ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const isSuperAdmin = currentUser.role === "Super admin";

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSavingProfile(true);
    try {
      const result = await backendAuth.updateProfile({ name, profileImageUrl, profileImageKey });
      const updatedUser: User = {
        ...currentUser,
        name: result.data.name,
        profileImageUrl: result.data.image ?? undefined,
        profileImageKey: result.data.profileImageKey ?? undefined,
      };
      updateUser(updatedUser);
      await refreshData();
      deleteReplacedProfilePhoto(savedProfileImageKey, updatedUser.profileImageKey);
      setSavedProfileImageKey(updatedUser.profileImageKey ?? "");
      logActivity({ action: "Updated", entity: "Profile", summary: `${updatedUser.name} updated their profile.`, details: [`Name: ${updatedUser.name}`, `Profile photo: ${updatedUser.profileImageUrl ? "Updated" : "Not set"}`], severity: "success" });
      showToast("Profile updated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      showToast("New passwords do not match", "error");
      return;
    }
    setIsChangingPassword(true);
    try {
      await backendAuth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      logActivity({ action: "Updated", entity: "Password", summary: `${currentUser.name} changed their password.`, severity: "info" });
      showToast("Password changed", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const closeProfileSettings = () => {
    discardDraftProfilePhoto(profileImageKey, savedProfileImageKey, showToast);
    onClose();
  };

  return (
    <Modal title="Profile Settings" onClose={closeProfileSettings}>
      {error && <p className="form-error">{error}</p>}
      <div className="profile-settings-grid">
        <form className="form-grid" onSubmit={saveProfile}>
          <ProfilePhotoField name={name} value={profileImageUrl} fileKey={profileImageKey} savedFileKey={savedProfileImageKey} onChange={(url, key) => { setProfileImageUrl(url); setProfileImageKey(key ?? ""); }} />
          <FormInput label="Display name" required value={name} disabled={isSuperAdmin} onChange={setName} />
          {isSuperAdmin && <p className="section-note">The Super admin name is fixed as Cecille Cosme.</p>}
          <div className="form-actions"><button type="button" className="secondary-btn" disabled={isSavingProfile} onClick={closeProfileSettings}>Close</button><button className="primary-btn" disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save Profile"}</button></div>
        </form>
        <form className="form-grid" onSubmit={changePassword}>
          <h3>Change Password</h3>
          <FormInput label="Current password" required type="password" value={currentPassword} onChange={setCurrentPassword} />
          <FormInput label="New password" required minLength={8} type="password" value={newPassword} onChange={setNewPassword} />
          <FormInput label="Confirm new password" required minLength={8} type="password" value={confirmPassword} onChange={setConfirmPassword} />
          <div className="form-actions"><button className="primary-btn" disabled={isChangingPassword}>{isChangingPassword ? "Changing..." : "Change Password"}</button></div>
        </form>
      </div>
    </Modal>
  );
}
