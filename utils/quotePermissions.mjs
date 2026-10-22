import { ChannelType, PermissionFlagsBits as Permission } from "discord.js";

const READ = Permission.ViewChannel | Permission.ReadMessageHistory;

// A conservative proof for all members, including role/member deny overwrites.
// A same-channel preview can also expose old messages to viewers without history.
function universallyAllows(channel, everyone, required) {
  const overwrites = channel.permissionOverwrites?.cache;
  if (!overwrites || !everyone?.permissions) return false;
  let permissions = everyone.permissions.bitfield;
  const base = overwrites.get(everyone.id);
  if (base) permissions = (permissions & ~base.deny.bitfield) | base.allow.bitfield;
  if ((permissions & required) !== required) return false;
  return [...overwrites.values()].every((overwrite) =>
    (overwrite.deny.bitfield & required) === 0n
  );
}

async function permissionChannel(guild, channel) {
  if (!channel || channel.guildId !== guild.id) return null;
  if (!channel.isThread()) return channel;
  if (!channel.parentId) return null;
  const parent = await guild.channels.fetch(channel.parentId, { force: true });
  return parent?.guildId === guild.id && !parent.isThread() ? parent : null;
}

// Return the authorized source, without fetching any message bodies on failure.
// Cross-channel previews require a source readable by everyone in this guild.
// Restricted sources keep their original links unless quoting in the same channel
// and every viewer can also read its history. Unknown permission data fails closed.
export async function authorizedQuoteSource(message, channelId, privateCategories = []) {
  const guild = message.guild;
  if (!guild) return null;
  try {
    const [source, destination, member, roles] = await Promise.all([
      guild.channels.fetch(channelId, { force: true }),
      channelId === message.channel.id
        ? Promise.resolve(null)
        : guild.channels.fetch(message.channel.id, { force: true }),
      guild.members.fetch({ user: message.author.id, force: true }),
      guild.roles.fetch(),
    ]);
    if (!source?.isTextBased() || !source.messages || member?.id !== message.author.id) return null;
    const sameChannel = channelId === message.channel.id;
    const [sourcePermissions, destinationPermissions] = await Promise.all([
      permissionChannel(guild, source),
      sameChannel ? Promise.resolve(null) : permissionChannel(guild, destination),
    ]);
    if (!sourcePermissions || (!sameChannel && !destinationPermissions)) return null;
    const actorPermissions = sourcePermissions.permissionsFor(member);
    if (!actorPermissions?.has(READ)) return null;
    const everyone = roles.get(guild.id);

    if (source.type === ChannelType.PrivateThread) {
      if (!sameChannel) return null;
      if (!actorPermissions.has(Permission.ManageThreads)) {
        // fetch() can return a collection when the member is not in its cache.
        const membership = await source.members.fetch({ member: member.id, force: true });
        if (membership?.id !== member.id && !membership?.has?.(member.id)) return null;
      }
    }
    if (sameChannel) return universallyAllows(sourcePermissions, everyone, Permission.ReadMessageHistory) ? source : null;

    if (!destinationPermissions.permissionsFor(member)?.has(Permission.ViewChannel)) return null;
    if (privateCategories.includes(sourcePermissions.parentId)) return null;
    if (sourcePermissions.nsfw && !destinationPermissions.nsfw) return null;
    return universallyAllows(sourcePermissions, everyone, READ) ? source : null;
  } catch {
    return null;
  }
}
